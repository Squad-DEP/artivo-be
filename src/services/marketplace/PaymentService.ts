import { PaymentLogModel } from '../../models/PaymentLog';
import { PaymentLogRepository } from '../../repositories/PaymentLogRepository';
import { JobService } from './JobService';
import { EscrowService } from './EscrowService';
import { JOB_STATUS, PAYMENT_STATUS } from '../../constants/statuses';

export interface CreatePaymentLogDTO {
    jobId: string;
    squadTransactionId: string;
    amount: number;
    status: string;
}

export class PaymentService {
    private jobService: JobService;
    private escrowService: EscrowService;
    private paymentLogRepo: PaymentLogRepository;

    constructor(jobService: JobService, escrowService?: EscrowService, paymentLogRepo = new PaymentLogRepository()) {
        this.jobService      = jobService;
        this.escrowService   = escrowService ?? new EscrowService();
        this.paymentLogRepo  = paymentLogRepo;
    }

    /**
     * Log an inbound payment from the Squad webhook.
     *
     * Idempotent — safe to call multiple times for the same transaction_ref.
     * On success, marks the job as 'paid' and funds the escrow entry so the
     * job can proceed to completion and payout.
     */
    async logPayment(data: CreatePaymentLogDTO): Promise<PaymentLogModel> {
        const existing = await this.getPaymentLogByTransactionId(data.squadTransactionId);
        if (existing) return existing;

        const paymentLog = await this.paymentLogRepo.create({
            jobId:              data.jobId,
            squadTransactionId: data.squadTransactionId,
            amount:             data.amount,
            status:             data.status,
        });

        if (data.status === PAYMENT_STATUS.SUCCESS || data.status === PAYMENT_STATUS.COMPLETED) {
            await this.jobService.updateJobStatus(data.jobId, JOB_STATUS.PAID);
            try {
                await this.escrowService.fundEscrow(data.jobId);
            } catch (err) {
                console.warn(`[PaymentService] Could not fund escrow for job ${data.jobId}:`, err);
            }
        }

        return paymentLog;
    }

    async getPaymentLogsByJob(jobId: string): Promise<PaymentLogModel[]> {
        return this.paymentLogRepo.findByJobId(jobId);
    }

    async getPaymentLogByTransactionId(squadTransactionId: string): Promise<PaymentLogModel | null> {
        return this.paymentLogRepo.findByTransactionId(squadTransactionId);
    }
}
