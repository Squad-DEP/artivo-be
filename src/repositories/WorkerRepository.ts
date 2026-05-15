import { QueryTypes } from 'sequelize';
import { sequelize } from '../providers/db';
import { JobSubscription, JobSubscriptionModel } from '../models/JobSubscription';
import { ReputationScore, ReputationScoreModel } from '../models/ReputationScore';
import { JobRequestForWorker } from '../services/marketplace/WorkerJobService';

export class WorkerRepository {
    async getStats(workerId: string): Promise<{
        total_jobs: string;
        active_jobs: string;
        completed_jobs: string;
        total_earned: string;
        pending_earnings: string;
    }> {
        const [stats] = await sequelize.query<{
            total_jobs: string;
            active_jobs: string;
            completed_jobs: string;
            total_earned: string;
            pending_earnings: string;
        }>(`
            SELECT
                COUNT(DISTINCT j.id)::int                                                               AS total_jobs,
                COUNT(DISTINCT CASE WHEN j.status = 'in_progress' THEN j.id END)::int                  AS active_jobs,
                COUNT(DISTINCT CASE WHEN j.status IN ('completed','paid') AND ee.id IS NOT NULL
                                    THEN j.id END)::int                                                 AS completed_jobs,
                COALESCE(SUM(CASE WHEN j.status IN ('completed','paid') AND ee.id IS NOT NULL
                                  AND j.payment_method != 'offline'
                                  THEN j.amount ELSE 0 END), 0)                                        AS total_earned,
                COALESCE(SUM(CASE WHEN j.status = 'in_progress' THEN j.amount ELSE 0 END), 0)          AS pending_earnings
            FROM jobs j
            LEFT JOIN escrow_entries ee ON ee.job_id = j.id AND ee.status = 'released'
            WHERE j.worker_id = $1
        `, { bind: [workerId], type: QueryTypes.SELECT });

        return stats;
    }

    async getEarningsRows(workerId: string): Promise<{
        job_id: string; title: string; customer_name: string; amount: string; completed_at: Date | null;
        payment_method: string; payout_reference: string | null;
        wl_status: string | null; wl_amount: string | null;
        bank_name: string | null; account_number: string | null;
    }[]> {
        return sequelize.query<{
            job_id: string; title: string; customer_name: string; amount: string; completed_at: Date | null;
            payment_method: string; payout_reference: string | null;
            wl_status: string | null; wl_amount: string | null;
            bank_name: string | null; account_number: string | null;
        }>(`
            SELECT j.id AS job_id, jr.title, uc.full_name AS customer_name,
                   j.amount, j.completed_at, j.payment_method,
                   j.payout_reference,
                   wl.status AS wl_status, wl.amount AS wl_amount,
                   wba.bank_name, wba.account_number
            FROM jobs j
            JOIN job_requests jr ON jr.id = j.job_request_id
            JOIN users uc ON uc.id = j.customer_id
            JOIN escrow_entries ee ON ee.job_id = j.id AND ee.status = 'released'
            LEFT JOIN withdrawal_logs wl ON wl.squad_transaction_reference = j.payout_reference
            LEFT JOIN worker_bank_accounts wba ON wba.user_id = j.worker_id
            WHERE j.worker_id = $1
              AND j.status IN ('completed', 'paid')
              AND j.payment_method != 'offline'
            ORDER BY j.completed_at DESC NULLS LAST
        `, { bind: [workerId], type: QueryTypes.SELECT });
    }

    async getSubscriptions(workerId: string): Promise<{ id: string; job_type_id: string; job_type_name: string; created_at: Date }[]> {
        return sequelize.query(`
            SELECT js.id, js.job_type_id, jt.name AS job_type_name, js.created_at
            FROM job_subscriptions js
            JOIN job_types jt ON jt.id = js.job_type_id
            WHERE js.worker_id = $1
            ORDER BY jt.name ASC
        `, { bind: [workerId], type: QueryTypes.SELECT }) as Promise<any[]>;
    }

    async getAvailableJobs(workerId: string): Promise<JobRequestForWorker[]> {
        const query = `
            SELECT
                jr.id,
                jr.customer_id,
                u.full_name as customer_name,
                jr.job_type_id,
                jt.name as job_type_name,
                jr.title,
                jr.description,
                jr.location,
                jr.budget,
                jr.status,
                jr.created_at
            FROM job_requests jr
            JOIN users u ON jr.customer_id = u.id
            JOIN job_types jt ON jr.job_type_id = jt.id
            WHERE jr.status = 'open'
            AND jr.customer_id != $1
            AND jr.job_type_id IN (
                SELECT job_type_id FROM job_subscriptions WHERE worker_id = $1
            )
            AND NOT EXISTS (
                SELECT 1 FROM job_proposals jp
                WHERE jp.job_request_id = jr.id
                AND jp.worker_id = $1
            )
            ORDER BY jr.created_at DESC
        `;

        return sequelize.query<JobRequestForWorker>(query, {
            bind: [workerId],
            type: QueryTypes.SELECT,
        });
    }

    async getAllOpenJobs(): Promise<JobRequestForWorker[]> {
        const query = `
            SELECT
                jr.id,
                jr.customer_id,
                u.full_name as customer_name,
                jr.job_type_id,
                jt.name as job_type_name,
                jr.title,
                jr.description,
                jr.location,
                jr.budget,
                jr.status,
                jr.created_at
            FROM job_requests jr
            JOIN users u ON jr.customer_id = u.id
            JOIN job_types jt ON jr.job_type_id = jt.id
            WHERE jr.status = 'open'
            ORDER BY jr.created_at DESC
        `;

        return sequelize.query<JobRequestForWorker>(query, {
            type: QueryTypes.SELECT,
        });
    }

    async getProposals(workerId: string): Promise<any[]> {
        return sequelize.query(`
            SELECT jp.id, jp.job_request_id, jp.proposed_amount, jp.proposed_amount_max,
                   jp.status, jp.created_at,
                   jr.title, jr.description, jr.location, jr.budget,
                   jt.name AS job_type,
                   u.full_name AS customer_name,
                   jr.status AS job_request_status
            FROM job_proposals jp
            JOIN job_requests jr ON jp.job_request_id = jr.id
            JOIN job_types jt ON jr.job_type_id = jt.id
            JOIN users u ON jr.customer_id = u.id
            WHERE jp.worker_id = $1
            AND jr.status NOT IN ('assigned', 'completed')
            ORDER BY jp.created_at DESC
        `, { bind: [workerId], type: QueryTypes.SELECT }) as Promise<any[]>;
    }

    async getProfileWithStats(userId: string): Promise<{ phone: string | null; email: string; average_rating: number } | null> {
        const results = await sequelize.query<{ phone: string | null; email: string; average_rating: number }>(
            `SELECT u.phone, u.email, COALESCE(rs.average_rating, 0) AS average_rating
             FROM users u
             LEFT JOIN reputation_scores rs ON rs.user_id = u.id
             WHERE u.id = $1`,
            { bind: [userId], type: QueryTypes.SELECT }
        );
        return results[0] ?? null;
    }

    async findSubscription(workerId: string, jobTypeId: string): Promise<JobSubscriptionModel | null> {
        return JobSubscription.findOne({ where: { workerId, jobTypeId } });
    }

    async createSubscription(workerId: string, jobTypeId: string): Promise<JobSubscriptionModel> {
        return JobSubscription.create({ workerId, jobTypeId });
    }

    async deleteSubscription(workerId: string, jobTypeId: string): Promise<number> {
        return JobSubscription.destroy({ where: { workerId, jobTypeId } });
    }

    async findReputationByUserId(userId: string): Promise<ReputationScoreModel | null> {
        return ReputationScore.findOne({ where: { userId } });
    }
}
