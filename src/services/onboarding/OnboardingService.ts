import User from '../../models/User';
import { WorkerProfile } from '../../models/WorkerProfile';
import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';

export interface SaveProfileDTO {
    fullName?: string;
    phone?: string;
    skills?: string;   // comma-separated string from frontend
    bio?: string;
    tagline?: string;
    location?: string;
    experience?: string;
    avgPay?: string;
}

export class OnboardingService {
    /**
     * Get all available job types from the database
     */
    async getJobTypes(): Promise<Array<{id: string, name: string}>> {
        const jobTypes = await sequelize.query<{id: string, name: string}>(
            'SELECT id, name FROM job_types ORDER BY name',
            { type: QueryTypes.SELECT }
        );
        return jobTypes;
    }

    /**
     * Persist AI-extracted onboarding data for a user.
     * Always marks the user as onboarded on success.
     * For workers, upserts the worker profile.
     */
    async saveProfile(userId: string, data: SaveProfileDTO): Promise<void> {
        const user = await User.findByPk(userId, { rejectOnEmpty: true });

        const userUpdates: Record<string, any> = { onboarded: true };
        if (data.fullName) userUpdates.fullName = data.fullName;
        if (data.phone)    userUpdates.phone    = data.phone;
        await user.update(userUpdates);

        if (user.role === 'worker') {
            await this.upsertWorkerProfile(userId, user.fullName, data);
        }
    }

    /** Strip base64 URI prefixes the browser may prepend to recorded audio. */
    sanitizeAudioData(audioData: string): string {
        return audioData.replace(/^data:audio\/\w+;base64,/, '').trim();
    }

    private async upsertWorkerProfile(
        userId: string,
        fallbackName: string,
        data: SaveProfileDTO
    ): Promise<void> {
        const displayName = data.fullName || fallbackName;
        const shareSlug   = this.generateSlug(displayName, userId);

        const [profile] = await WorkerProfile.findOrCreate({
            where:    { userId },
            defaults: { userId, displayName, shareSlug },
        });

        const updates: Record<string, any> = {};
        if (data.fullName) updates.displayName = data.fullName;
        if (data.skills)   updates.skills      = this.parseSkills(data.skills);
        if (data.bio)      updates.bio         = data.bio;
        if (data.tagline)  updates.tagline     = data.tagline;
        if (data.location) updates.location    = data.location;

        if (Object.keys(updates).length > 0) await profile.update(updates);
    }

    private parseSkills(raw: string): string[] {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    }

    private generateSlug(name: string, userId: string): string {
        const base = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 80);
        return `${base}-${userId.slice(0, 6)}`;
    }
}
