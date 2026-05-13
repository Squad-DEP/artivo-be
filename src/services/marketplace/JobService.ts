import { Job, JobModel, JobStatus } from '../../models/Job';
import { JobRequestService } from './JobRequestService';
import { sequelize } from '../../providers/db';
import { JOB_STATUS, JOB_REQUEST_STATUS, USER_ROLE } from '../../constants/statuses';

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

    async verifyJobOwnership(id: string, userId: string, role: 'customer' | 'worker'): Promise<boolean> {
        const whereClause = role === USER_ROLE.CUSTOMER
            ? { id, customerId: userId }
            : { id, workerId: userId };

        const job = await Job.findOne({ where: whereClause });
        return job !== null;
    }
}
