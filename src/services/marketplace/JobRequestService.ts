import { JobRequest, JobRequestModel, JobRequestStatus } from '../../models/JobRequest';
import { JOB_REQUEST_STATUS } from '../../constants/statuses';

export interface CreateJobRequestDTO {
    customerId: string;
    jobTypeId: string;
    title: string;
    description?: string;
    location?: string;
    budget?: number;
}

export class JobRequestService {
    async createJobRequest(data: CreateJobRequestDTO): Promise<JobRequestModel> {
        return JobRequest.create({
            customerId: data.customerId,
            jobTypeId: data.jobTypeId,
            title: data.title,
            description: data.description || null,
            location: data.location || null,
            budget: data.budget || null,
            status: JOB_REQUEST_STATUS.OPEN,
        });
    }

    async getJobRequestById(id: string): Promise<JobRequestModel | null> {
        return JobRequest.findByPk(id);
    }

    async getJobRequestsByCustomer(customerId: string): Promise<JobRequestModel[]> {
        return JobRequest.findAll({
            where: { customerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async updateJobRequestStatus(id: string, status: JobRequestStatus, t?: any): Promise<void> {
        await JobRequest.update({ status }, { where: { id }, ...(t ? { transaction: t } : {}) });
    }

    async verifyJobRequestOwnership(id: string, customerId: string): Promise<boolean> {
        const jobRequest = await JobRequest.findOne({
            where: { id, customerId, status: JOB_REQUEST_STATUS.OPEN },
        });
        return jobRequest !== null;
    }
}
