import { Job, JobModel, JobStatus } from '../../models/Job';
import { JobRequestService } from './JobRequestService';
import { sequelize } from '../../providers/db';

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
            // Get job request to extract customer_id if not provided
            let customerId = data.customerId;
            if (!customerId) {
                const jobRequest = await this.jobRequestService.getJobRequestById(data.jobRequestId);
                if (!jobRequest) {
                    throw new Error('Job request not found');
                }
                customerId = jobRequest.customerId;
            }

            // Create the job
            const job = await Job.create({
                jobRequestId: data.jobRequestId,
                workerId: data.workerId,
                customerId,
                amount: data.amount,
                status: 'pending',
            }, { transaction });

            // Update job request status
            await this.jobRequestService.updateJobRequestStatus(data.jobRequestId, 'assigned');

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
        
        if (status === 'completed') {
            updateData.completedAt = new Date();
        }

        await Job.update(updateData, { where: { id } });
    }

    async completeJob(id: string): Promise<void> {
        const transaction = await sequelize.transaction();

        try {
            // Update job status
            await Job.update(
                { status: 'completed', completedAt: new Date() },
                { where: { id }, transaction },
            );

            // Get job to update job request
            const job = await Job.findByPk(id, { transaction });
            if (job) {
                await this.jobRequestService.updateJobRequestStatus(job.jobRequestId, 'completed');
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async verifyJobOwnership(id: string, userId: string, role: 'customer' | 'worker'): Promise<boolean> {
        const whereClause = role === 'customer' 
            ? { id, customerId: userId }
            : { id, workerId: userId };

        const job = await Job.findOne({ where: whereClause });
        return job !== null;
    }
}
