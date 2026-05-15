import { Transaction, QueryTypes } from 'sequelize';
import { Job, JobModel, JobStatus } from '../models/Job';
import { sequelize } from '../providers/db';
import { JOB_STATUS } from '../constants/statuses';
import { CreateJobDTO } from '../services/marketplace/JobService';

export class JobRepository {
    async findById(id: string): Promise<JobModel | null> {
        return Job.findByPk(id);
    }

    async findByWorker(workerId: string): Promise<JobModel[]> {
        return Job.findAll({
            where: { workerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async findByCustomer(customerId: string): Promise<JobModel[]> {
        return Job.findAll({
            where: { customerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async create(data: CreateJobDTO & { status: string; paymentMethod: string }, t?: Transaction): Promise<JobModel> {
        return Job.create({
            jobRequestId:  data.jobRequestId,
            workerId:      data.workerId,
            customerId:    data.customerId,
            amount:        data.amount,
            status:        data.status as any,
            paymentMethod: data.paymentMethod as any,
        }, { transaction: t });
    }

    async updateStatus(id: string, status: JobStatus, data?: { completedAt?: Date }, t?: Transaction): Promise<void> {
        const updateData: any = { status, ...data };
        await Job.update(updateData, { where: { id }, ...(t ? { transaction: t } : {}) });
    }

    async updatePayoutReference(id: string, reference: string): Promise<void> {
        await Job.update({ payoutReference: reference }, { where: { id } });
    }

    async findByWorkerAndId(id: string, workerId: string): Promise<JobModel | null> {
        return Job.findOne({ where: { id, workerId } });
    }

    async findByCustomerAndId(id: string, customerId: string): Promise<JobModel | null> {
        return Job.findOne({ where: { id, customerId } });
    }

    async getCustomerStats(customerId: string): Promise<{
        total_jobs: string;
        active_jobs: string;
        completed_jobs: string;
        total_spent: string;
        pending_payments: string;
    }> {
        const [stats] = await sequelize.query<{
            total_jobs: string;
            active_jobs: string;
            completed_jobs: string;
            total_spent: string;
            pending_payments: string;
        }>(`
            SELECT
                COUNT(DISTINCT j.id)::int                                                                           AS total_jobs,
                COUNT(DISTINCT CASE WHEN j.status = 'in_progress' THEN j.id END)::int                              AS active_jobs,
                COUNT(DISTINCT CASE WHEN j.status IN ('completed','paid') AND ee.id IS NOT NULL THEN j.id END)::int AS completed_jobs,
                COALESCE(SUM(CASE WHEN j.status IN ('completed','paid') AND ee.id IS NOT NULL
                                  AND j.payment_method != 'offline'
                                  THEN j.amount ELSE 0 END), 0)                                                     AS total_spent,
                COALESCE(SUM(CASE WHEN j.status = 'in_progress' THEN j.amount ELSE 0 END), 0)                      AS pending_payments
            FROM jobs j
            LEFT JOIN escrow_entries ee ON ee.job_id = j.id AND ee.status = 'released'
            WHERE j.customer_id = $1
        `, { bind: [customerId], type: QueryTypes.SELECT });

        return stats;
    }

    async getEnrichedByCustomer(customerId: string): Promise<any[]> {
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

    async getEnrichedByWorker(workerId: string): Promise<any[]> {
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

    async findByUserId(userId: string): Promise<JobModel[]> {
        return Job.findAll({ where: { workerId: userId }, order: [['created_at', 'DESC']], limit: 50 });
    }

    async findByCustomerUserId(userId: string): Promise<JobModel[]> {
        return Job.findAll({ where: { customerId: userId }, order: [['created_at', 'DESC']], limit: 50 });
    }
}
