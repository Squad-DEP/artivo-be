import { QueryTypes } from 'sequelize';
import { JobRequest, JobRequestModel, JobRequestStatus } from '../models/JobRequest';
import { sequelize } from '../providers/db';
import { JOB_REQUEST_STATUS } from '../constants/statuses';
import { CreateJobRequestDTO } from '../services/marketplace/JobRequestService';

export class JobRequestRepository {
    async create(data: CreateJobRequestDTO): Promise<JobRequestModel> {
        return JobRequest.create({
            customerId:  data.customerId,
            jobTypeId:   data.jobTypeId,
            title:       data.title,
            description: data.description || null,
            location:    data.location || null,
            budget:      data.budget || null,
            status:      JOB_REQUEST_STATUS.OPEN,
        });
    }

    async findById(id: string): Promise<JobRequestModel | null> {
        return JobRequest.findByPk(id);
    }

    async findByCustomer(customerId: string): Promise<JobRequestModel[]> {
        return JobRequest.findAll({
            where: { customerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async updateStatus(id: string, status: JobRequestStatus, t?: any): Promise<void> {
        await JobRequest.update({ status }, { where: { id }, ...(t ? { transaction: t } : {}) });
    }

    async findOpenByIdAndCustomer(id: string, customerId: string): Promise<JobRequestModel | null> {
        return JobRequest.findOne({ where: { id, customerId, status: JOB_REQUEST_STATUS.OPEN } });
    }

    async findByIdAndCustomer(id: string, customerId: string): Promise<JobRequestModel | null> {
        return JobRequest.findOne({ where: { id, customerId } });
    }

    async findJobTypeById(jobTypeId: string): Promise<{ id: string } | null> {
        const [jobType] = await sequelize.query<{ id: string }>(
            'SELECT id FROM job_types WHERE id = $1',
            { bind: [jobTypeId], type: QueryTypes.SELECT }
        );
        return jobType ?? null;
    }

    async getWithProposalCount(customerId: string): Promise<any[]> {
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

    /**
     * Fetch a job request with its job type name and id — used by the matching engine.
     */
    async findByIdWithJobType(id: string): Promise<{
        id: string;
        title: string;
        description: string;
        location: string;
        budget: number;
        job_type: string;
        job_type_id: string;
    } | null> {
        const [row] = await sequelize.query<any>(`
            SELECT jr.id, jr.title, jr.description, jr.location, jr.budget,
                   jt.name AS job_type, jt.id AS job_type_id
            FROM job_requests jr
            JOIN job_types jt ON jt.id = jr.job_type_id
            WHERE jr.id = $1
        `, { bind: [id], type: QueryTypes.SELECT });
        return row ?? null;
    }

    async getProposalsForRequest(jobRequestId: string): Promise<any[]> {
        const proposals = await sequelize.query(`
            SELECT jp.id, jp.worker_id,
                   u.full_name AS worker_name,
                   wp.photo_url,
                   wp.share_slug,
                   jp.proposed_amount, jp.proposed_amount_max,
                   jp.status, jp.created_at
            FROM job_proposals jp
            JOIN users u ON u.id = jp.worker_id
            LEFT JOIN worker_profiles wp ON wp.user_id = jp.worker_id
            WHERE jp.job_request_id = $1
            ORDER BY jp.created_at ASC
        `, { bind: [jobRequestId], type: QueryTypes.SELECT });
        return proposals as any[];
    }
}
