import { JobSubscription, JobSubscriptionModel } from '../../models/JobSubscription';
import { Job } from '../../models/Job';
import { ReputationScore } from '../../models/ReputationScore';
import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';

export interface WorkerJobStatsShape {
    total_jobs: number;
    active_jobs: number;
    completed_jobs: number;
    total_earned: number;
    pending_earnings: number;
    completion_rate: number;
    average_rating: number;
}

export interface JobRequestForWorker {
    id: string;
    customer_id: string;
    customer_name: string;
    job_type_id: string;
    job_type_name: string;
    title: string;
    description: string;
    location: string;
    budget: number;
    status: string;
    created_at: Date;
}

export class WorkerJobService {
    async subscribeToJobType(workerId: string, jobTypeId: string): Promise<JobSubscriptionModel> {
        // Check if already subscribed
        const existing = await JobSubscription.findOne({
            where: { workerId, jobTypeId },
        });

        if (existing) {
            return existing;
        }

        return await JobSubscription.create({
            workerId,
            jobTypeId,
        });
    }

    async unsubscribeFromJobType(workerId: string, jobTypeId: string): Promise<boolean> {
        const deleted = await JobSubscription.destroy({
            where: { workerId, jobTypeId },
        });

        return deleted > 0;
    }

    async getWorkerSubscriptions(workerId: string): Promise<JobSubscriptionModel[]> {
        return await JobSubscription.findAll({
            where: { workerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async getAvailableJobsForWorker(workerId: string): Promise<JobRequestForWorker[]> {
        const query = `
            SELECT 
                jr.id,
                jr.customer_id,
                u.full_name as customer_name,
                jr.job_type_id,
                jt.name as job_type_name,
                jr.title,
                jr.description,
                jr.location,
                jr.budget,
                jr.status,
                jr.created_at
            FROM job_requests jr
            JOIN users u ON jr.customer_id = u.id
            JOIN job_types jt ON jr.job_type_id = jt.id
            WHERE jr.status = 'open'
            AND jr.job_type_id IN (
                SELECT job_type_id 
                FROM job_subscriptions 
                WHERE worker_id = $1
            )
            ORDER BY jr.created_at DESC
        `;

        return await sequelize.query<JobRequestForWorker>(query, {
            bind: [workerId],
            type: QueryTypes.SELECT,
        });
    }

    async getWorkerStats(workerId: string): Promise<WorkerJobStatsShape> {
        const jobs = await Job.findAll({ where: { workerId } });
        const active = jobs.filter(j => j.status === 'in_progress').length;
        const completed = jobs.filter(j => j.status === 'completed' || j.status === 'paid').length;
        const totalEarned = jobs.filter(j => j.status === 'paid').reduce((sum, j) => sum + Number(j.amount), 0);
        const pendingEarnings = jobs.filter(j => j.status === 'in_progress').reduce((sum, j) => sum + Number(j.amount), 0);

        const rep = await ReputationScore.findOne({ where: { userId: workerId } });

        return {
            total_jobs: jobs.length,
            active_jobs: active,
            completed_jobs: completed,
            total_earned: totalEarned,
            pending_earnings: pendingEarnings,
            completion_rate: Number(rep?.completionRate ?? 0),
            average_rating: Number(rep?.averageRating ?? 0),
        };
    }

    async getAllOpenJobs(): Promise<JobRequestForWorker[]> {
        const query = `
            SELECT 
                jr.id,
                jr.customer_id,
                u.full_name as customer_name,
                jr.job_type_id,
                jt.name as job_type_name,
                jr.title,
                jr.description,
                jr.location,
                jr.budget,
                jr.status,
                jr.created_at
            FROM job_requests jr
            JOIN users u ON jr.customer_id = u.id
            JOIN job_types jt ON jr.job_type_id = jt.id
            WHERE jr.status = 'open'
            ORDER BY jr.created_at DESC
        `;

        return await sequelize.query<JobRequestForWorker>(query, {
            type: QueryTypes.SELECT,
        });
    }
}
