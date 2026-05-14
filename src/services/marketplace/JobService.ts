import { Job, JobModel, JobStatus } from '../../models/Job';
import { JobRequest } from '../../models/JobRequest';
import { JobRequestService } from './JobRequestService';
import { sequelize } from '../../providers/db';
import { Transaction, QueryTypes } from 'sequelize';
import { JOB_STATUS, JOB_REQUEST_STATUS, USER_ROLE } from '../../constants/statuses';

export interface CustomerJobStatsShape {
    total_jobs: number;
    active_jobs: number;
    completed_jobs: number;
    total_spent: number;
    pending_payments: number;
}

export interface CreateJobDTO {
    jobRequestId: string;
    workerId: string;
    customerId: string;
    amount: number;
    paymentMethod?: 'online' | 'offline';
}

export class JobService {
    private jobRequestService: JobRequestService;

    constructor(jobRequestService: JobRequestService) {
        this.jobRequestService = jobRequestService;
    }

    async createJob(data: CreateJobDTO, externalTx?: Transaction): Promise<JobModel> {
        const run = async (t: Transaction) => {
            let customerId = data.customerId;
            if (!customerId) {
                const jobRequest = await this.jobRequestService.getJobRequestById(data.jobRequestId);
                if (!jobRequest) throw new Error('Job request not found');
                customerId = jobRequest.customerId;
            }

            const job = await Job.create({
                jobRequestId: data.jobRequestId,
                workerId: data.workerId,
                customerId,
                amount: data.amount,
                status: JOB_STATUS.PENDING,
                paymentMethod: data.paymentMethod ?? 'online',
            }, { transaction: t });

            await this.jobRequestService.updateJobRequestStatus(
                data.jobRequestId, JOB_REQUEST_STATUS.ASSIGNED, t
            );

            return job;
        };

        if (externalTx) return run(externalTx);
        return sequelize.transaction(run);
    }

    async getJobById(id: string): Promise<JobModel | null> {
        return Job.findByPk(id);
    }

    async getJobsByWorker(workerId: string): Promise<JobModel[]> {
        return Job.findAll({
            where: { workerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async getJobsByCustomer(customerId: string): Promise<JobModel[]> {
        return Job.findAll({
            where: { customerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async updateJobStatus(id: string, status: JobStatus, t?: Transaction): Promise<void> {
        const updateData: any = { status };
        if (status === JOB_STATUS.COMPLETED) {
            updateData.completedAt = new Date();
        }
        await Job.update(updateData, { where: { id }, ...(t ? { transaction: t } : {}) });
    }

    async completeJob(id: string): Promise<void> {
        const transaction = await sequelize.transaction();

        try {
            await Job.update(
                { status: JOB_STATUS.COMPLETED, completedAt: new Date() },
                { where: { id }, transaction }
            );

            const job = await Job.findByPk(id, { transaction });
            if (job) {
                await this.jobRequestService.updateJobRequestStatus(job.jobRequestId, JOB_REQUEST_STATUS.COMPLETED);
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getCustomerStats(customerId: string): Promise<CustomerJobStatsShape> {
        const jobs = await Job.findAll({ where: { customerId } });
        const active = jobs.filter(j => j.status === 'in_progress').length;
        const completed = jobs.filter(j => j.status === 'completed' || j.status === 'paid').length;
        const totalSpent = jobs.filter(j => j.status === 'paid').reduce((sum, j) => sum + Number(j.amount), 0);
        const pendingPayments = jobs.filter(j => j.status === 'in_progress').reduce((sum, j) => sum + Number(j.amount), 0);

        return {
            total_jobs: jobs.length,
            active_jobs: active,
            completed_jobs: completed,
            total_spent: totalSpent,
            pending_payments: pendingPayments,
        };
    }

    async getJobsForUser(userId: string): Promise<any[]> {
        const [workerJobs, customerJobs, jobRequests] = await Promise.all([
            Job.findAll({ where: { workerId: userId }, order: [['created_at', 'DESC']], limit: 50 }),
            Job.findAll({ where: { customerId: userId }, order: [['created_at', 'DESC']], limit: 50 }),
            JobRequest.findAll({ where: { customerId: userId }, order: [['created_at', 'DESC']], limit: 50 }),
        ]);

        const allJobIds = new Set<string>();
        const allJobs: any[] = [];

        [...workerJobs, ...customerJobs].forEach(j => {
            if (!allJobIds.has(j.id)) {
                allJobIds.add(j.id);
                allJobs.push({
                    id: j.id,
                    title: `Job #${j.id.slice(0, 8)}`,
                    description: '',
                    status: j.status,
                    budget_min: Number(j.amount),
                    budget_max: Number(j.amount),
                    final_amount: Number(j.amount),
                    worker_id: j.workerId,
                    customer_id: j.customerId,
                    created_at: j.createdAt,
                    stages: [],
                });
            }
        });

        jobRequests.forEach(jr => {
            allJobs.push({
                id: jr.id,
                title: jr.title,
                description: jr.description || '',
                status: jr.status,
                budget_min: Number(jr.budget ?? 0),
                budget_max: Number(jr.budget ?? 0),
                customer_id: jr.customerId,
                created_at: jr.createdAt,
                stages: [],
            });
        });

        return allJobs;
    }

    async verifyJobOwnership(id: string, userId: string, role: 'customer' | 'worker'): Promise<boolean> {
        const whereClause = role === USER_ROLE.CUSTOMER
            ? { id, customerId: userId }
            : { id, workerId: userId };

        const job = await Job.findOne({ where: whereClause });
        return job !== null;
    }

    async getEnrichedJobsByCustomer(customerId: string): Promise<{
        id: string; job_request_id: string; worker_id: string; worker_name: string;
        worker_photo: string | null; title: string; description: string;
        location: string | null; amount: number; payment_method: string;
        status: string; created_at: Date; worker_confirmed: boolean; customer_confirmed: boolean;
    }[]> {
        return sequelize.query(`
            SELECT j.id, j.job_request_id, j.worker_id,
                   uw.full_name AS worker_name, wp.photo_url AS worker_photo,
                   jr.title, jr.description, jr.location,
                   j.amount, j.payment_method, j.status, j.created_at,
                   COALESCE(e.worker_confirmed, false) AS worker_confirmed,
                   COALESCE(e.customer_confirmed, false) AS customer_confirmed
            FROM jobs j
            JOIN job_requests jr ON jr.id = j.job_request_id
            JOIN users uw ON uw.id = j.worker_id
            LEFT JOIN worker_profiles wp ON wp.user_id = j.worker_id
            LEFT JOIN escrow_entries e ON e.job_id = j.id
            WHERE j.customer_id = $1
            AND j.status NOT IN ('pending_payment', 'cancelled')
            ORDER BY j.created_at DESC
        `, { bind: [customerId], type: QueryTypes.SELECT }) as Promise<any[]>;
    }

    async getEnrichedJobsByWorker(workerId: string): Promise<{
        id: string; job_request_id: string; customer_id: string; customer_name: string;
        title: string; description: string; location: string | null;
        amount: number; payment_method: string; status: string; created_at: Date;
        worker_confirmed: boolean; customer_confirmed: boolean;
    }[]> {
        return sequelize.query(`
            SELECT j.id, j.job_request_id, j.customer_id,
                   uc.full_name AS customer_name,
                   jr.title, jr.description, jr.location,
                   j.amount, j.payment_method, j.status, j.created_at,
                   COALESCE(e.worker_confirmed, false) AS worker_confirmed,
                   COALESCE(e.customer_confirmed, false) AS customer_confirmed
            FROM jobs j
            JOIN job_requests jr ON jr.id = j.job_request_id
            JOIN users uc ON uc.id = j.customer_id
            LEFT JOIN escrow_entries e ON e.job_id = j.id
            WHERE j.worker_id = $1
            AND j.status NOT IN ('pending_payment', 'cancelled')
            ORDER BY j.created_at DESC
        `, { bind: [workerId], type: QueryTypes.SELECT }) as Promise<any[]>;
    }
}
