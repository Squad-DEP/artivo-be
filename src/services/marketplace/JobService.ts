import { Job, JobModel, JobStatus } from '../../models/Job';
import { JobRequest } from '../../models/JobRequest';
import { JobRequestService } from './JobRequestService';
import { sequelize } from '../../providers/db';
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
}

export class JobService {
    private jobRequestService: JobRequestService;

    constructor(jobRequestService: JobRequestService) {
        this.jobRequestService = jobRequestService;
    }

    async createJob(data: CreateJobDTO): Promise<JobModel> {
        const transaction = await sequelize.transaction();

        try {
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
            }, { transaction });

            await this.jobRequestService.updateJobRequestStatus(data.jobRequestId, JOB_REQUEST_STATUS.ASSIGNED);

            await transaction.commit();
            return job;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
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

    async updateJobStatus(id: string, status: JobStatus): Promise<void> {
        const updateData: any = { status };
        if (status === JOB_STATUS.COMPLETED) {
            updateData.completedAt = new Date();
        }
        await Job.update(updateData, { where: { id } });
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
}
