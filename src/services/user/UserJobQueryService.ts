import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';

interface JobDetails {
    id: string;
    title: string;
    description: string;
    category: { id: string; name: string };
    budget_min: number;
    budget_max: number;
    final_amount?: number;
    location: { city: string; state: string; country: string };
    customer_id: string;
    customer_name: string;
    worker_id?: string;
    status: string;
    stages: any[];
    created_at: Date;
    updated_at: Date;
}

interface JobApplication {
    id: string;
    job_id: string;
    worker_id: string;
    worker: {
        id: string;
        name: string;
        full_name: string;
        photo_url: string | null;
        bio: string | null;
        average_rating: number;
        total_jobs: number;
    };
    proposed_amount: number;
    status: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * UserJobQueryService - Handles job-related queries for users
 * Follows Single Responsibility Principle: Only handles job queries from user perspective
 */
export class UserJobQueryService {
    /**
     * Get job details by ID for a specific user
     * Checks if user is either the customer or worker on the job
     */
    async getJobById(jobId: string, userId: string): Promise<JobDetails | null> {
        // First, try to find as a job request
        const jobRequest = await this.getJobRequestById(jobId, userId);
        if (jobRequest) {
            return jobRequest;
        }

        // If not found, try to find as an active job
        const job = await this.getActiveJobById(jobId, userId);
        return job;
    }

    /**
     * Get job request details (before it becomes an active job)
     */
    private async getJobRequestById(jobId: string, userId: string): Promise<JobDetails | null> {
        const [row] = await sequelize.query<any>(`
            SELECT
                jr.id,
                jr.title,
                jr.description,
                jr.location,
                jr.budget        AS budget_min,
                jr.budget        AS budget_max,
                jr.status,
                jr.customer_id,
                u.full_name      AS customer_name,
                jr.job_type_id,
                jt.name          AS category_name,
                jr.created_at,
                jr.created_at    AS updated_at
            FROM job_requests jr
            JOIN users u  ON jr.customer_id = u.id
            JOIN job_types jt ON jr.job_type_id = jt.id
            WHERE jr.id = $1
              AND (jr.customer_id = $2 OR jr.id IN (
                  SELECT job_request_id FROM jobs WHERE worker_id = $2
              ))
        `, { bind: [jobId, userId], type: QueryTypes.SELECT });

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            title: row.title,
            description: row.description,
            category: { id: row.job_type_id, name: row.category_name },
            budget_min: Number(row.budget_min ?? 0),
            budget_max: Number(row.budget_max ?? 0),
            location: { city: row.location ?? '', state: '', country: 'NG' },
            customer_id: row.customer_id,
            customer_name: row.customer_name,
            status: row.status,
            stages: [],
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    /**
     * Get active job details (after a worker has been assigned)
     */
    private async getActiveJobById(jobId: string, userId: string): Promise<JobDetails | null> {
        const [job] = await sequelize.query<any>(`
            SELECT
                j.id,
                jr.title,
                jr.description,
                jr.location,
                j.amount         AS budget_min,
                j.amount         AS budget_max,
                j.amount         AS final_amount,
                j.status,
                j.customer_id,
                cu.full_name     AS customer_name,
                j.worker_id,
                jr.job_type_id,
                jt.name          AS category_name,
                j.created_at,
                j.created_at     AS updated_at
            FROM jobs j
            JOIN job_requests jr ON j.job_request_id = jr.id
            JOIN users cu ON j.customer_id = cu.id
            JOIN job_types jt ON jr.job_type_id = jt.id
            WHERE j.id = $1
              AND (j.customer_id = $2 OR j.worker_id = $2)
        `, { bind: [jobId, userId], type: QueryTypes.SELECT });

        if (!job) {
            return null;
        }

        return {
            id: job.id,
            title: job.title,
            description: job.description,
            category: { id: job.job_type_id, name: job.category_name },
            budget_min: Number(job.budget_min ?? 0),
            budget_max: Number(job.budget_max ?? 0),
            final_amount: Number(job.final_amount ?? 0),
            location: { city: job.location ?? '', state: '', country: 'NG' },
            customer_id: job.customer_id,
            customer_name: job.customer_name,
            worker_id: job.worker_id,
            status: job.status,
            stages: [],
            created_at: job.created_at,
            updated_at: job.updated_at,
        };
    }

    /**
     * Get all job applications/proposals for a specific job
     * Only accessible by the job's customer
     */
    async getJobApplications(jobId: string, userId: string): Promise<JobApplication[]> {
        const proposals = await sequelize.query<any>(`
            SELECT
                jp.id,
                jp.job_request_id   AS job_id,
                jp.worker_id,
                jp.proposed_amount,
                jp.status,
                jp.created_at,
                jp.created_at       AS updated_at,
                wu.full_name        AS worker_name,
                wp.photo_url,
                wp.bio,
                rs.average_rating,
                rs.total_jobs
            FROM job_proposals jp
            JOIN users wu ON jp.worker_id = wu.id
            LEFT JOIN worker_profiles wp ON jp.worker_id = wp.user_id
            LEFT JOIN reputation_scores rs ON jp.worker_id = rs.user_id
            WHERE jp.job_request_id = $1
              AND EXISTS (
                  SELECT 1 FROM job_requests jr
                  WHERE jr.id = $1 AND jr.customer_id = $2
              )
            ORDER BY jp.created_at DESC
        `, { bind: [jobId, userId], type: QueryTypes.SELECT });

        return proposals.map((p: any) => ({
            id: p.id,
            job_id: p.job_id,
            worker_id: p.worker_id,
            worker: {
                id: p.worker_id,
                name: p.worker_name,
                full_name: p.worker_name,
                photo_url: p.photo_url,
                bio: p.bio,
                average_rating: Number(p.average_rating ?? 0),
                total_jobs: Number(p.total_jobs ?? 0),
            },
            proposed_amount: Number(p.proposed_amount),
            status: p.status,
            created_at: p.created_at,
            updated_at: p.updated_at,
        }));
    }
}
