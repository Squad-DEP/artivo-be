import { Transaction } from 'sequelize';
import { JobModel, JobStatus } from '../../models/Job';
import { JobRequestService } from './JobRequestService';
import { JobRepository } from '../../repositories/JobRepository';
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
    paymentMethod?: 'online' | 'offline';
}

export class JobService {
    private jobRequestService: JobRequestService;
    private jobRepo: JobRepository;

    constructor(jobRequestService: JobRequestService, jobRepo = new JobRepository()) {
        this.jobRequestService = jobRequestService;
        this.jobRepo = jobRepo;
    }

    async createJob(data: CreateJobDTO, externalTx?: Transaction): Promise<JobModel> {
        const run = async (t: Transaction) => {
            let customerId = data.customerId;
            if (!customerId) {
                const jobRequest = await this.jobRequestService.getJobRequestById(data.jobRequestId);
                if (!jobRequest) throw new Error('Job request not found');
                customerId = jobRequest.customerId;
            }

            const job = await this.jobRepo.create({
                jobRequestId:  data.jobRequestId,
                workerId:      data.workerId,
                customerId,
                amount:        data.amount,
                status:        JOB_STATUS.PENDING,
                paymentMethod: data.paymentMethod ?? 'online',
            }, t);

            await this.jobRequestService.updateJobRequestStatus(
                data.jobRequestId, JOB_REQUEST_STATUS.ASSIGNED, t
            );

            return job;
        };

        if (externalTx) return run(externalTx);
        return sequelize.transaction(run);
    }

    async getJobById(id: string): Promise<JobModel | null> {
        return this.jobRepo.findById(id);
    }

    async getJobsByWorker(workerId: string): Promise<JobModel[]> {
        return this.jobRepo.findByWorker(workerId);
    }

    async getJobsByCustomer(customerId: string): Promise<JobModel[]> {
        return this.jobRepo.findByCustomer(customerId);
    }

    async updateJobStatus(id: string, status: JobStatus, t?: Transaction): Promise<void> {
        const data: { completedAt?: Date } = {};
        if (status === JOB_STATUS.COMPLETED) {
            data.completedAt = new Date();
        }
        await this.jobRepo.updateStatus(id, status, data, t);
    }

    async completeJob(id: string): Promise<void> {
        const transaction = await sequelize.transaction();

        try {
            await this.jobRepo.updateStatus(id, JOB_STATUS.COMPLETED as JobStatus, { completedAt: new Date() }, transaction);

            const job = await this.jobRepo.findById(id);
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
        const stats = await this.jobRepo.getCustomerStats(customerId);

        return {
            total_jobs:       Number(stats.total_jobs),
            active_jobs:      Number(stats.active_jobs),
            completed_jobs:   Number(stats.completed_jobs),
            total_spent:      Number(stats.total_spent),
            pending_payments: Number(stats.pending_payments),
        };
    }

    async getJobsForUser(userId: string): Promise<any[]> {
        const [workerJobs, customerJobs, jobRequests] = await Promise.all([
            this.jobRepo.findByUserId(userId),
            this.jobRepo.findByCustomerUserId(userId),
            this.jobRequestService.getJobRequestsByCustomer(userId),
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
        const job = role === USER_ROLE.CUSTOMER
            ? await this.jobRepo.findByCustomerAndId(id, userId)
            : await this.jobRepo.findByWorkerAndId(id, userId);
        return job !== null;
    }

    async getEnrichedJobsByCustomer(customerId: string): Promise<{
        id: string; job_request_id: string; worker_id: string; worker_name: string;
        worker_photo: string | null; title: string; description: string;
        location: string | null; amount: number; payment_method: string;
        status: string; created_at: Date; worker_confirmed: boolean; customer_confirmed: boolean;
    }[]> {
        return this.jobRepo.getEnrichedByCustomer(customerId);
    }

    async getEnrichedJobsByWorker(workerId: string): Promise<{
        id: string; job_request_id: string; customer_id: string; customer_name: string;
        title: string; description: string; location: string | null;
        amount: number; payment_method: string; status: string; created_at: Date;
        worker_confirmed: boolean; customer_confirmed: boolean;
    }[]> {
        return this.jobRepo.getEnrichedByWorker(workerId);
    }
}
