import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';

export interface WorkerFeedItem {
    id: string;
    full_name: string;
    phone: string;
    display_name: string;
    photo_url: string;
    bio: string;
    skills: string[];
    location: string;
    share_slug: string;
    credit_score: number;
    completion_rate: number;
    total_jobs: number;
    average_rating: number;
}

export interface WorkerFeedFilters {
    location?: string;
    jobTypeId?: string;
    limit?: number;
}

export class WorkerService {
    async getWorkerFeed(filters: WorkerFeedFilters): Promise<WorkerFeedItem[]> {
        const { location, limit = 20 } = filters;

        let whereClause = "WHERE u.role = 'worker'";
        const params: any[] = [];
        let paramIndex = 1;

        if (location) {
            whereClause += ` AND wp.location ILIKE $${paramIndex}`;
            params.push(`%${location}%`);
            paramIndex++;
        }

        const query = `
            SELECT 
                u.id,
                u.full_name,
                u.phone,
                wp.display_name,
                wp.photo_url,
                wp.bio,
                wp.skills,
                wp.location,
                wp.share_slug,
                COALESCE(rs.credit_score, 0) as credit_score,
                COALESCE(rs.completion_rate, 0) as completion_rate,
                COALESCE(rs.total_jobs, 0) as total_jobs,
                COALESCE(rs.average_rating, 0) as average_rating
            FROM users u
            JOIN worker_profiles wp ON u.id = wp.user_id
            LEFT JOIN reputation_scores rs ON u.id = rs.user_id
            ${whereClause}
            ORDER BY rs.average_rating DESC NULLS LAST, rs.total_jobs DESC NULLS LAST
            LIMIT $${paramIndex}
        `;
        params.push(limit);

        const workers = await sequelize.query<WorkerFeedItem>(query, {
            bind: params,
            type: QueryTypes.SELECT,
        });

        return workers;
    }

    async getWorkerById(workerId: string): Promise<WorkerFeedItem | null> {
        const query = `
            SELECT 
                u.id,
                u.full_name,
                u.phone,
                wp.display_name,
                wp.photo_url,
                wp.bio,
                wp.skills,
                wp.location,
                wp.share_slug,
                COALESCE(rs.credit_score, 0) as credit_score,
                COALESCE(rs.completion_rate, 0) as completion_rate,
                COALESCE(rs.total_jobs, 0) as total_jobs,
                COALESCE(rs.average_rating, 0) as average_rating
            FROM users u
            JOIN worker_profiles wp ON u.id = wp.user_id
            LEFT JOIN reputation_scores rs ON u.id = rs.user_id
            WHERE u.id = $1 AND u.role = 'worker'
        `;

        const workers = await sequelize.query<WorkerFeedItem>(query, {
            bind: [workerId],
            type: QueryTypes.SELECT,
        });

        return workers.length > 0 ? workers[0] : null;
    }

    async getWorkerBySlug(slug: string): Promise<WorkerFeedItem | null> {
        const query = `
            SELECT 
                u.id,
                u.full_name,
                u.phone,
                wp.display_name,
                wp.photo_url,
                wp.bio,
                wp.skills,
                wp.location,
                wp.share_slug,
                COALESCE(rs.credit_score, 0) as credit_score,
                COALESCE(rs.completion_rate, 0) as completion_rate,
                COALESCE(rs.total_jobs, 0) as total_jobs,
                COALESCE(rs.average_rating, 0) as average_rating
            FROM users u
            JOIN worker_profiles wp ON u.id = wp.user_id
            LEFT JOIN reputation_scores rs ON u.id = rs.user_id
            WHERE wp.share_slug = $1 AND u.role = 'worker'
        `;

        const workers = await sequelize.query<WorkerFeedItem>(query, {
            bind: [slug],
            type: QueryTypes.SELECT,
        });

        return workers.length > 0 ? workers[0] : null;
    }
}
