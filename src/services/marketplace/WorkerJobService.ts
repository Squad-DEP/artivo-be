import { JobSubscription, JobSubscriptionModel } from '../../models/JobSubscription';
import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';

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
