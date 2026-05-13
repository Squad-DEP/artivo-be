import { PaymentLog, PaymentLogModel } from '../../models/PaymentLog';
import { JobService } from './JobService';
import { EscrowService } from './EscrowService';
import { SquadService } from '../squad/SquadService';
import { JOB_STATUS, PAYMENT_STATUS, SQUAD_TX_STATUS } from '../../constants/statuses';

export interface CreatePaymentLogDTO {
    jobId: string;
    squadTransactionId: string;
    amount: number;
    status: string;
}

export interface VerifyAndLogPaymentDTO {
    jobId: string;
    squadTransactionReference: string;
    /** Expected amount in NGN (naira). Squad returns kobo so we convert for comparison. */
    expectedAmountNgn: number;
}

export class PaymentService {
    private jobService: JobService;
    private escrowService: EscrowService;
    private squadService: SquadService;

    constructor(
        jobService: JobService,
        escrowService?: EscrowService,
        squadService?: SquadService
    ) {
        this.jobService = jobService;
        this.escrowService = escrowService ?? new EscrowService();
        this.squadService = squadService ?? new SquadService();
    }

    /**
     * Log a payment directly (called by the Squad webhook after Squad confirms).
     * Idempotent: safe to call multiple times for the same transaction.
     * Also funds the escrow entry for the job.
     */
    async logPayment(data: CreatePaymentLogDTO): Promise<PaymentLogModel> {
        const existing = await this.getPaymentLogByTransactionId(data.squadTransactionId);
        if (existing) return existing;

        const paymentLog = await PaymentLog.create({
            jobId: data.jobId,
            squadTransactionId: data.squadTransactionId,
            amount: data.amount,
            status: data.status,
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

    /**
     * Verify a transaction with Squad using GET /transaction/verify/:ref,
     * then log the payment if verified.
     *
     * Flow:
     *  1. Call Squad's verify endpoint with the reference.
     *  2. Confirm status is 'success'.
     *  3. Confirm amount matches the job amount (Squad returns kobo; job stores NGN).
     *  4. Log the payment idempotently and fund escrow.
     */
    async verifyAndLogPayment(data: VerifyAndLogPaymentDTO): Promise<PaymentLogModel> {
        const result = await this.squadService.verifyTransaction(data.squadTransactionReference);

        if (!result.success || !result.data) {
            throw new Error('Transaction not found on Squad. Verification failed.');
        }

        const tx = result.data;

        if (tx.transaction_status !== SQUAD_TX_STATUS.SUCCESS) {
            throw new Error(
                `Transaction status is '${tx.transaction_status}', not '${SQUAD_TX_STATUS.SUCCESS}'. Verification failed.`
            );
        }

        // Squad stores amount in kobo; job.amount is in NGN
        const txAmountNgn = tx.amount / 100;
        if (Math.abs(txAmountNgn - data.expectedAmountNgn) > 0.01) {
            throw new Error(
                `Amount mismatch: expected ₦${data.expectedAmountNgn}, got ₦${txAmountNgn}.`
            );
        }

        return this.logPayment({
            jobId: data.jobId,
            squadTransactionId: data.squadTransactionReference,
            amount: txAmountNgn,
            status: PAYMENT_STATUS.SUCCESS,
        });
    }

    async getPaymentLogsByJob(jobId: string): Promise<PaymentLogModel[]> {
        return PaymentLog.findAll({
            where: { jobId },
            order: [['createdAt', 'DESC']],
        });
    }

    async getPaymentLogByTransactionId(squadTransactionId: string): Promise<PaymentLogModel | null> {
        return PaymentLog.findOne({ where: { squadTransactionId } });
    }
}
