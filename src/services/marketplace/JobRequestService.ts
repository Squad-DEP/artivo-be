import { JobRequestModel, JobRequestStatus } from '../../models/JobRequest';
import { JobRequestRepository } from '../../repositories/JobRequestRepository';

export interface CreateJobRequestDTO {
    customerId: string;
    jobTypeId: string;
    title: string;
    description?: string;
    location?: string;
    budget?: number;
}

export class JobRequestService {
    private repo: JobRequestRepository;

    constructor(repo = new JobRequestRepository()) {
        this.repo = repo;
    }

    async createJobRequest(data: CreateJobRequestDTO): Promise<JobRequestModel> {
        const jobType = await this.repo.findJobTypeById(data.jobTypeId);
        if (!jobType) {
            const err: any = new Error('Job type not found');
            err.status = 404;
            throw err;
        }

        return this.repo.create(data);
    }

    async getJobRequestById(id: string): Promise<JobRequestModel | null> {
        return this.repo.findById(id);
    }

    async getJobRequestsByCustomer(customerId: string): Promise<JobRequestModel[]> {
        return this.repo.findByCustomer(customerId);
    }

    async updateJobRequestStatus(id: string, status: JobRequestStatus, t?: any): Promise<void> {
        await this.repo.updateStatus(id, status, t);
    }

    async verifyJobRequestOwnership(id: string, customerId: string): Promise<boolean> {
        const jobRequest = await this.repo.findOpenByIdAndCustomer(id, customerId);
        return jobRequest !== null;
    }

    async getJobRequestsWithProposalCount(customerId: string): Promise<{
        id: string; title: string; description: string; location: string | null;
        budget: number | null; status: string; job_type_name: string;
        proposal_count: number; created_at: Date;
    }[]> {
        return this.repo.getWithProposalCount(customerId);
    }

    async getProposalsForJobRequest(jobRequestId: string, customerId: string): Promise<{
        id: string; worker_id: string; worker_name: string; photo_url: string | null;
        proposed_amount: number; proposed_amount_max: number | null;
        status: string; created_at: Date;
    }[] | null> {
        // Ownership check stays in service
        const jobRequest = await this.repo.findByIdAndCustomer(jobRequestId, customerId);
        if (!jobRequest) return null;

        return this.repo.getProposalsForRequest(jobRequestId);
    }
}
