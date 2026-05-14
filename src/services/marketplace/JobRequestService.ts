import { JobRequest, JobRequestModel, JobRequestStatus } from '../../models/JobRequest';
import { JOB_REQUEST_STATUS } from '../../constants/statuses';
import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';

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
        // Validate job_type_id exists — gives a clear 404 instead of a cryptic FK error
        const [jobType] = await sequelize.query<{ id: string }>(
            'SELECT id FROM job_types WHERE id = $1',
            { bind: [data.jobTypeId], type: QueryTypes.SELECT }
        );
        if (!jobType) {
            const err: any = new Error('Job type not found');
            err.status = 404;
            throw err;
        }

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

    async getJobRequestsWithProposalCount(customerId: string): Promise<{
        id: string; title: string; description: string; location: string | null;
        budget: number | null; status: string; job_type_name: string;
        proposal_count: number; created_at: Date;
    }[]> {
        return sequelize.query(`
            SELECT jr.id, jr.title, jr.description, jr.location, jr.budget, jr.status,
                   jt.name AS job_type_name,
                   COALESCE(COUNT(jp.id), 0)::int AS proposal_count,
                   jr.created_at
            FROM job_requests jr
            JOIN job_types jt ON jr.job_type_id = jt.id
            LEFT JOIN job_proposals jp ON jp.job_request_id = jr.id
            WHERE jr.customer_id = $1
            GROUP BY jr.id, jt.name
            ORDER BY jr.created_at DESC
        `, { bind: [customerId], type: QueryTypes.SELECT }) as Promise<any[]>;
    }

    async getProposalsForJobRequest(jobRequestId: string, customerId: string): Promise<{
        id: string; worker_id: string; worker_name: string; photo_url: string | null;
        proposed_amount: number; proposed_amount_max: number | null;
        status: string; created_at: Date;
    }[] | null> {
        // Verify ownership first
        const jobRequest = await JobRequest.findOne({ where: { id: jobRequestId, customerId } });
        if (!jobRequest) return null;

        const proposals = await sequelize.query(`
            SELECT jp.id, jp.worker_id,
                   u.full_name AS worker_name,
                   wp.photo_url,
                   jp.proposed_amount, jp.proposed_amount_max,
                   jp.status, jp.created_at
            FROM job_proposals jp
            JOIN users u ON u.id = jp.worker_id
            LEFT JOIN worker_profiles wp ON wp.user_id = jp.worker_id
            WHERE jp.job_request_id = $1
            ORDER BY jp.created_at ASC
        `, { bind: [jobRequestId], type: QueryTypes.SELECT });
        return proposals as any;
    }
}
