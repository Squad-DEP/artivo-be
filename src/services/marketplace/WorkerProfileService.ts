import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';
import { WorkerProfile } from '../../models/WorkerProfile';
import { WorkerExperience } from '../../models/WorkerExperience';
import { WorkerEducation } from '../../models/WorkerEducation';
import { WorkerCertification } from '../../models/WorkerCertification';
import { WorkerPortfolio } from '../../models/WorkerPortfolio';
import { User } from '../../models/User';

export interface FullWorkerProfile {
    display_name: string;
    photo_url: string | null;
    bio: string | null;
    tagline: string | null;
    skills: string[];
    location: string | null;
    share_slug: string;
    phone: string | null;
    email: string;
    average_rating: number;
    hourly_rate: number | null;
    minimum_budget: number | null;
    languages: string[];
    availability: string;
    categories: string[];
    experience: ExperienceItem[];
    education: EducationItem[];
    certifications: CertificationItem[];
    portfolio: PortfolioItem[];
}

export interface ExperienceItem {
    id: string;
    title: string;
    company: string;
    start_year: number;
    end_year: number | null;
    description: string | null;
}

export interface EducationItem {
    id: string;
    title: string;
    institution: string;
    year: number | null;
    file_url: string | null;
}

export interface CertificationItem {
    id: string;
    title: string;
    issuer: string;
    year: number | null;
    file_url: string | null;
}

export interface PortfolioItem {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    images: string[];
    category: string | null;
    created_at: Date;
}

export class WorkerProfileService {
    /**
     * Find or create the worker_profile row, generating a slug from the user's name.
     */
    async findOrCreate(userId: string): Promise<InstanceType<typeof WorkerProfile>> {
        const user = await User.unscoped().findOne({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        const shareSlug =
            user.fullName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') +
            '-' +
            userId.slice(0, 6);

        const [profile] = await WorkerProfile.findOrCreate({
            where: { userId },
            defaults: { userId, displayName: user.fullName, shareSlug, photoUrl: null },
        });

        return profile;
    }

    /**
     * Return the complete profile payload for a worker.
     */
    async getFullProfile(userId: string): Promise<FullWorkerProfile> {
        const profile = await this.findOrCreate(userId);

        // Single query for contact + rating — avoids N+1 on User + ReputationScore
        const [stats] = await sequelize.query<{ phone: string | null; email: string; average_rating: number }>(
            `SELECT u.phone, u.email, COALESCE(rs.average_rating, 0) AS average_rating
             FROM users u
             LEFT JOIN reputation_scores rs ON rs.user_id = u.id
             WHERE u.id = $1`,
            { bind: [userId], type: QueryTypes.SELECT }
        );

        // Parallel fetch of relational collections
        const [experience, education, certifications, portfolio] = await Promise.all([
            WorkerExperience.findAll({ where: { userId }, order: [['startYear', 'DESC']], raw: true }),
            WorkerEducation.findAll({ where: { userId }, order: [['year', 'DESC']], raw: true }),
            WorkerCertification.findAll({ where: { userId }, order: [['year', 'DESC']], raw: true }),
            WorkerPortfolio.findAll({ where: { userId }, order: [['createdAt', 'DESC']], raw: true }),
        ]);

        return {
            display_name:   profile.displayName,
            photo_url:      profile.photoUrl ?? null,
            bio:            profile.bio ?? null,
            tagline:        profile.tagline ?? null,
            skills:         profile.skills ?? [],
            location:       profile.location ?? null,
            share_slug:     profile.shareSlug,
            phone:          stats?.phone ?? null,
            email:          stats?.email ?? '',
            average_rating: Number(stats?.average_rating ?? 0),
            hourly_rate:    profile.hourlyRate != null ? Number(profile.hourlyRate) : null,
            minimum_budget: profile.minimumBudget != null ? Number(profile.minimumBudget) : null,
            languages:      profile.languages ?? [],
            availability:   profile.availability ?? 'available',
            categories:     profile.categories ?? [],
            // NOTE: Sequelize raw:true aliases columns to JS attribute names (camelCase),
            // NOT to the DB column names. Use attribute names here, not field names.
            experience: (experience as any[]).map(e => ({
                id:          e.id,
                title:       e.title,
                company:     e.company,
                start_year:  e.startYear,
                end_year:    e.endYear ?? null,
                description: e.description ?? null,
            })),
            education: (education as any[]).map(e => ({
                id:          e.id,
                title:       e.title,
                institution: e.institution,
                year:        e.year ?? null,
                file_url:    e.fileUrl ?? null,
            })),
            certifications: (certifications as any[]).map(c => ({
                id:      c.id,
                title:   c.title,
                issuer:  c.issuer,
                year:    c.year ?? null,
                file_url: c.fileUrl ?? null,
            })),
            portfolio: (portfolio as any[]).map(p => ({
                id:          p.id,
                title:       p.title,
                description: p.description ?? null,
                image_url:   p.imageUrl ?? null,
                images:      p.images ?? [],
                category:    p.category ?? null,
                created_at:  p.createdAt,
            })),
        };
    }

    async updateProfile(userId: string, data: Partial<{
        displayName: string;
        photoUrl: string;
        bio: string;
        tagline: string;
        skills: string[];
        location: string;
        hourlyRate: number;
        minimumBudget: number;
        languages: string[];
        availability: string;
        categories: string[];
    }>): Promise<void> {
        const profile = await this.findOrCreate(userId);
        await profile.update(data);
    }

    /**
     * Look up a worker's full profile by their public share_slug.
     * Returns null if the slug does not exist.
     */
    async getBySlug(slug: string): Promise<FullWorkerProfile | null> {
        const { WorkerProfile } = await import('../../models/WorkerProfile');
        const profile = await WorkerProfile.findOne({ where: { shareSlug: slug } });
        if (!profile) return null;
        return this.getFullProfile(profile.userId);
    }
}
