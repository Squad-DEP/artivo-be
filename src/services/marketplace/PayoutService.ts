import crypto from 'crypto';
import { Job } from '../../models/Job';
import { WorkerBankAccount } from '../../models/WorkerBankAccount';
import { EscrowAdvanceRequest } from '../../models/EscrowAdvanceRequest';
import { WithdrawalLog } from '../../models/WithdrawalLog';
import { ADVANCE_REQUEST_STATUS, WITHDRAWAL_STATUS } from '../../constants/statuses';
import { SquadService } from '../squad/SquadService';

export type PayoutMode = 'sandbox_skip' | 'live';

export class PayoutService {
    private squadService: SquadService;

    constructor(squadService?: SquadService) {
        this.squadService = squadService ?? new SquadService();
    }

    /**
     * Initiate the final payout for a completed job.
     * Calculates the remaining amount (total escrow minus approved advances)
     * and transfers it from the Squad merchant wallet to the worker's registered bank account.
     *
     * In sandbox: Squad's payout API may not work end-to-end, so we log and continue.
     */
    async initiateJobPayout(jobId: string): Promise<{ reference: string; amount: number; skipped: boolean }> {
        const job = await Job.findByPk(jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);

        // Offline jobs are paid directly — no payout needed
        if (job.paymentMethod === 'offline') {
            return { reference: 'offline', amount: 0, skipped: true };
        }

        const bankAccount = await WorkerBankAccount.findOne({ where: { userId: job.workerId } });
        if (!bankAccount) {
            throw new Error('Worker has not registered a bank account. Cannot initiate payout.');
        }

        // Subtract advances already paid out to avoid double payment
        const approvedAdvances = await EscrowAdvanceRequest.findAll({
            where: { jobId, status: ADVANCE_REQUEST_STATUS.APPROVED },
        });
        const alreadyPaid = approvedAdvances.reduce((s, r) => s + Number(r.amount), 0);
        const remainder = Number(job.amount) - alreadyPaid;

        if (remainder <= 0) {
            return { reference: 'fully-advanced', amount: 0, skipped: true };
        }

        const reference = this.buildReference(job.workerId, jobId);

        // Persist the payout intent before calling Squad (so we can requery on timeout)
        const log = await WithdrawalLog.create({
            userId: job.workerId,
            squadTransactionReference: reference,
            amount: remainder,
            bankCode: bankAccount.bankCode,
            accountNumber: bankAccount.accountNumber,
            accountName: bankAccount.accountName,
            status: WITHDRAWAL_STATUS.PENDING,
            remarks: `Artivo job payout — job ${jobId}`,
        });

        try {
            const response = await this.squadService.initiateTransfer({
                transaction_reference: reference,
                amount: String(Math.round(remainder * 100)), // NGN → kobo
                bank_code: bankAccount.bankCode,
                account_number: bankAccount.accountNumber,
                account_name: bankAccount.accountName,
                currency_id: 'NGN',
                remark: `Artivo job payout`,
            });

            const succeeded = response.success && (response.data as any)?.transaction_status !== 'failed';
            const newStatus = succeeded ? WITHDRAWAL_STATUS.SUCCESS : WITHDRAWAL_STATUS.FAILED;
            await WithdrawalLog.update({ status: newStatus }, { where: { id: log.id } });
            await Job.update({ payoutReference: reference }, { where: { id: jobId } });

            return { reference, amount: remainder, skipped: false };
        } catch (err: any) {
            // 424 = Squad gateway timeout — transfer may still succeed; leave pending for requery
            if (err?.statusCode === 424) {
                console.warn(`[PayoutService] Squad 424 timeout for job ${jobId}. Leaving as pending for requery.`);
                await Job.update({ payoutReference: reference }, { where: { id: jobId } });
                return { reference, amount: remainder, skipped: false };
            }

            // Any other error: log as failed but don't block job completion
            console.error(`[PayoutService] Squad payout failed for job ${jobId}:`, err.message);
            await WithdrawalLog.update({ status: WITHDRAWAL_STATUS.FAILED }, { where: { id: log.id } });
            throw new Error(`Payout failed: ${err.message}`);
        }
    }

    /**
     * Initiate a partial advance payout directly to the worker's bank account.
     * Called when customer approves an advance request.
     */
    async initiateAdvancePayout(
        workerId: string,
        amount: number,
        jobId: string,
        requestId: string
    ): Promise<{ reference: string }> {
        const bankAccount = await WorkerBankAccount.findOne({ where: { userId: workerId } });
        if (!bankAccount) {
            throw new Error('Worker has not registered a bank account. Cannot release advance.');
        }

        const reference = this.buildReference(workerId, `adv-${requestId.slice(0, 8)}`);

        const log = await WithdrawalLog.create({
            userId: workerId,
            squadTransactionReference: reference,
            amount,
            bankCode: bankAccount.bankCode,
            accountNumber: bankAccount.accountNumber,
            accountName: bankAccount.accountName,
            status: WITHDRAWAL_STATUS.PENDING,
            remarks: `Artivo advance payout — job ${jobId}`,
        });

        try {
            await this.squadService.initiateTransfer({
                transaction_reference: reference,
                amount: String(Math.round(amount * 100)),
                bank_code: bankAccount.bankCode,
                account_number: bankAccount.accountNumber,
                account_name: bankAccount.accountName,
                currency_id: 'NGN',
                remark: `Artivo advance payment`,
            });
            await WithdrawalLog.update({ status: WITHDRAWAL_STATUS.SUCCESS }, { where: { id: log.id } });
        } catch (err: any) {
            if (err?.statusCode !== 424) {
                await WithdrawalLog.update({ status: WITHDRAWAL_STATUS.FAILED }, { where: { id: log.id } });
                throw new Error(`Advance payout failed: ${err.message}`);
            }
        }

        return { reference };
    }

    private buildReference(userId: string, suffix: string): string {
        const unique = crypto.randomBytes(4).toString('hex').toUpperCase();
        const uid = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
        return `ARTIVO_${uid}_${suffix.replace(/-/g, '').slice(0, 8).toUpperCase()}_${unique}`;
    }
}
