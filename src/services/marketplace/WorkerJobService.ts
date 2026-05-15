import { WorkerRepository } from '../../repositories/WorkerRepository';

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
    private workerRepo: WorkerRepository;

    constructor(workerRepo = new WorkerRepository()) {
        this.workerRepo = workerRepo;
    }

    async subscribeToJobType(workerId: string, jobTypeId: string): Promise<any> {
        const existing = await this.workerRepo.findSubscription(workerId, jobTypeId);
        if (existing) return existing;
        return this.workerRepo.createSubscription(workerId, jobTypeId);
    }

    async unsubscribeFromJobType(workerId: string, jobTypeId: string): Promise<boolean> {
        const deleted = await this.workerRepo.deleteSubscription(workerId, jobTypeId);
        return deleted > 0;
    }

    async getWorkerSubscriptions(workerId: string): Promise<{ id: string; job_type_id: string; job_type_name: string; created_at: Date }[]> {
        return this.workerRepo.getSubscriptions(workerId);
    }

    async getAvailableJobsForWorker(workerId: string): Promise<JobRequestForWorker[]> {
        return this.workerRepo.getAvailableJobs(workerId);
    }

    async getWorkerStats(workerId: string): Promise<WorkerJobStatsShape> {
        const [stats, rep] = await Promise.all([
            this.workerRepo.getStats(workerId),
            this.workerRepo.findReputationByUserId(workerId),
        ]);

        return {
            total_jobs:       Number(stats.total_jobs),
            active_jobs:      Number(stats.active_jobs),
            completed_jobs:   Number(stats.completed_jobs),
            total_earned:     Number(stats.total_earned),
            pending_earnings: Number(stats.pending_earnings),
            completion_rate:  Number(rep?.completionRate ?? 0),
            average_rating:   Number(rep?.averageRating ?? 0),
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
        const rows = await this.workerRepo.getEarningsRows(workerId);

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

    async getWorkerProposals(workerId: string): Promise<any[]> {
        return this.workerRepo.getProposals(workerId);
    }

    async getWorkerProfileWithStats(userId: string): Promise<{ phone: string | null; email: string; average_rating: number } | null> {
        return this.workerRepo.getProfileWithStats(userId);
    }

    async getAllOpenJobs(): Promise<JobRequestForWorker[]> {
        return this.workerRepo.getAllOpenJobs();
    }
}
