import { JobSubscription, JobSubscriptionModel } from '../../models/JobSubscription';
import { Job } from '../../models/Job';
import { ReputationScore } from '../../models/ReputationScore';
import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';

export interface WorkerJobStatsShape {
    total_jobs: number;
    active_jobs: number;
    completed_jobs: number;
    total_earned: number;
    pending_earnings: number;
    completion_rate: number;
    average_rating: number;
}

export interface JobRequestForWorker {
    id: string;
    customer_id: string;
    customer_name: string;
    job_type_id: string;
    job_type_name: string;
    title: string;
    description: string;
    location: string;
    budget: number;
    status: string;
    created_at: Date;
}

export class WorkerJobService {
    async subscribeToJobType(workerId: string, jobTypeId: string): Promise<JobSubscriptionModel> {
        // Check if already subscribed
        const existing = await JobSubscription.findOne({
            where: { workerId, jobTypeId },
        });

        if (existing) {
            return existing;
        }

        return JobSubscription.create({
            workerId,
            jobTypeId,
        });
    }

    async unsubscribeFromJobType(workerId: string, jobTypeId: string): Promise<boolean> {
        const deleted = await JobSubscription.destroy({
            where: { workerId, jobTypeId },
        });

        return deleted > 0;
    }

    async getWorkerSubscriptions(workerId: string): Promise<JobSubscriptionModel[]> {
        return JobSubscription.findAll({
            where: { workerId },
            order: [['createdAt', 'DESC']],
        });
    }

    async getAvailableJobsForWorker(workerId: string): Promise<JobRequestForWorker[]> {
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

    async getWorkerStats(workerId: string): Promise<WorkerJobStatsShape> {
        const jobs = await Job.findAll({ where: { workerId } });
        const active = jobs.filter(j => j.status === 'in_progress').length;
        const completed = jobs.filter(j => j.status === 'completed' || j.status === 'paid').length;
        // Count completed + paid as earned (payout fires on completion)
        const totalEarned = jobs
            .filter(j => j.status === 'completed' || j.status === 'paid')
            .reduce((sum, j) => sum + Number(j.amount), 0);
        const pendingEarnings = jobs.filter(j => j.status === 'in_progress').reduce((sum, j) => sum + Number(j.amount), 0);

        const rep = await ReputationScore.findOne({ where: { userId: workerId } });

        return {
            total_jobs: jobs.length,
            active_jobs: active,
            completed_jobs: completed,
            total_earned: totalEarned,
            pending_earnings: pendingEarnings,
            completion_rate: Number(rep?.completionRate ?? 0),
            average_rating: Number(rep?.averageRating ?? 0),
        };
    }

    async getWorkerEarnings(workerId: string): Promise<{
        summary: { total_earned: number; total_paid_out: number; pending_payout: number; failed_payout: number };
        payouts: {
            job_id: string; title: string; customer_name: string; amount: number; completed_at: Date | null;
            payment_method: string; payout_reference: string | null;
            payout_status: 'success' | 'pending' | 'failed' | 'not_initiated' | 'offline';
            payout_amount: number | null; bank_name: string | null; account_last4: string | null;
        }[];
    }> {
        const rows = await sequelize.query<{
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
            LEFT JOIN withdrawal_logs wl ON wl.squad_transaction_reference = j.payout_reference
            LEFT JOIN worker_bank_accounts wba ON wba.user_id = j.worker_id
            WHERE j.worker_id = $1
              AND j.status IN ('completed', 'paid')
              AND j.payment_method != 'offline'
            ORDER BY j.completed_at DESC NULLS LAST
        `, { bind: [workerId], type: QueryTypes.SELECT });

        const payouts = rows.map(r => {
            let payout_status: 'success' | 'pending' | 'failed' | 'not_initiated' | 'offline' = 'not_initiated';
            if (r.payment_method === 'offline') payout_status = 'offline';
            else if (r.wl_status === 'success') payout_status = 'success';
            else if (r.wl_status === 'pending') payout_status = 'pending';
            else if (r.wl_status === 'failed') payout_status = 'failed';
            else if (!r.payout_reference) payout_status = 'not_initiated';

            return {
                job_id: r.job_id,
                title: r.title,
                customer_name: r.customer_name,
                amount: Number(r.amount),
                completed_at: r.completed_at,
                payment_method: r.payment_method,
                payout_reference: r.payout_reference ?? null,
                payout_status,
                payout_amount: r.wl_amount ? Number(r.wl_amount) : null,
                bank_name: r.bank_name ?? null,
                account_last4: r.account_number ? r.account_number.slice(-4) : null,
            };
        });

        const total_earned = payouts.reduce((s, p) => s + p.amount, 0);
        const total_paid_out = payouts.filter(p => p.payout_status === 'success').reduce((s, p) => s + (p.payout_amount ?? p.amount), 0);
        const pending_payout = payouts.filter(p => p.payout_status === 'pending').reduce((s, p) => s + p.amount, 0);
        const failed_payout = payouts.filter(p => p.payout_status === 'failed' || p.payout_status === 'not_initiated').reduce((s, p) => s + p.amount, 0);

        return { summary: { total_earned, total_paid_out, pending_payout, failed_payout }, payouts };
    }

    async getWorkerProposals(workerId: string): Promise<{
        id: string; job_request_id: string; proposed_amount: number;
        proposed_amount_max: number | null; status: string; created_at: string;
        title: string; description: string; location: string; budget: number;
        job_type: string; customer_name: string; job_request_status: string;
    }[]> {
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

    async getWorkerProfileWithStats(userId: string): Promise<{ phone: string | null; email: string; average_rating: number } | null> {
        const results = await sequelize.query<{ phone: string | null; email: string; average_rating: number }>(
            `SELECT u.phone, u.email, COALESCE(rs.average_rating, 0) AS average_rating
             FROM users u
             LEFT JOIN reputation_scores rs ON rs.user_id = u.id
             WHERE u.id = $1`,
            { bind: [userId], type: QueryTypes.SELECT }
        );
        return results[0] ?? null;
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
}
