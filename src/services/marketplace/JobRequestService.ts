import { JobRequest, JobRequestModel } from '../../models/JobRequest';

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
        const jobRequest = await JobRequest.create({
            customerId: data.customerId,
            jobTypeId: data.jobTypeId,
            title: data.title,
            description: data.description || null,
            location: data.location || null,
            budget: data.budget || null,
            status: 'open',
        });

        return jobRequest;
    }

    async getJobRequestById(id: string): Promise<JobRequestModel | null> {
        return await JobRequest.findByPk(id);
    }

    async getJobRequestsByCustomer(customerId: string): Promise<JobRequestModel[]> {
        return await JobRequest.findAll({
            where: { customerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async updateJobRequestStatus(id: string, status: 'open' | 'assigned' | 'completed' | 'cancelled'): Promise<void> {
        await JobRequest.update(
            { status },
            { where: { id } }
        );
    }

    async verifyJobRequestOwnership(id: string, customerId: string): Promise<boolean> {
        const jobRequest = await JobRequest.findOne({
            where: { id, customerId, status: 'open' },
        });
        return jobRequest !== null;
    }
}
