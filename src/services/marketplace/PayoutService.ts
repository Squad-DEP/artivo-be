import crypto from 'crypto';
import { Job } from '../../models/Job';
import { WorkerBankAccount } from '../../models/WorkerBankAccount';
import { VirtualAccount } from '../../models/VirtualAccount';
import { EscrowAdvanceRequest } from '../../models/EscrowAdvanceRequest';
import { WithdrawalLog } from '../../models/WithdrawalLog';
import { ADVANCE_REQUEST_STATUS, WITHDRAWAL_STATUS } from '../../constants/statuses';
import { SquadService } from '../squad/SquadService';
import { squadConfig } from '../../config/squad.config';

export type PayoutMode = 'sandbox_skip' | 'live';

const isSandbox = () => squadConfig.baseUrl.includes('sandbox');

export class PayoutService {
    private squadService: SquadService;

    constructor(squadService?: SquadService) {
        this.squadService = squadService ?? new SquadService();
    }

    /**
     * Initiate the final payout for a completed job.
     *
     * Sandbox: Squad's payout API rejects real-bank transfers ("Merchant not eligible").
     * Instead, credit the worker's virtual account balance directly — the money is already
     * in Artivo's Squad merchant wallet, so this is correct accounting.
     *
     * Live: call Squad Transfer API to send from merchant wallet to worker's registered bank.
     */
    async initiateJobPayout(jobId: string): Promise<{ reference: string; amount: number; skipped: boolean }> {
        const job = await Job.findByPk(jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);

        if (job.paymentMethod === 'offline') {
            return { reference: 'offline', amount: 0, skipped: true };
        }

        const approvedAdvances = await EscrowAdvanceRequest.findAll({
            where: { jobId, status: ADVANCE_REQUEST_STATUS.APPROVED },
        });
        const alreadyPaid = approvedAdvances.reduce((s, r) => s + Number(r.amount), 0);
        const remainder = Number(job.amount) - alreadyPaid;

        if (remainder <= 0) {
            return { reference: 'fully-advanced', amount: 0, skipped: true };
        }

        if (isSandbox()) {
            return this.sandboxPayout(jobId, job.workerId, remainder);
        }

        return this.livePayout(jobId, job.workerId, remainder);
    }

    /**
     * Sandbox payout: credit the worker's virtual account balance directly.
     * No Squad transfer API call needed — funds sit in Artivo's merchant wallet
     * and we reflect that in the worker's DB balance.
     */
    private async sandboxPayout(
        jobId: string,
        workerId: string,
        amount: number
    ): Promise<{ reference: string; amount: number; skipped: boolean }> {
        const reference = this.buildReference(workerId, jobId);

        // Credit worker's virtual account (may or may not exist — skip if not)
        const credited = await VirtualAccount.increment(
            { balance: amount },
            { where: { userId: workerId } }
        );
        const workerHasVirtualAccount = (credited as any)?.[1] > 0 || Array.isArray(credited);

        await WithdrawalLog.create({
            userId: workerId,
            squadTransactionReference: reference,
            amount,
            bankCode: 'SANDBOX',
            accountNumber: 'VIRTUAL',
            accountName: workerHasVirtualAccount ? 'Virtual account credited' : 'Sandbox payout',
            status: WITHDRAWAL_STATUS.SUCCESS,
            remarks: `[Sandbox] job payout — job ${jobId}`,
        });

        await Job.update({ payoutReference: reference }, { where: { id: jobId } });

        console.log(`[PayoutService] Sandbox payout of ₦${amount} for job ${jobId} → credited worker ${workerId} virtual account`);

        return { reference, amount, skipped: false };
    }

    /**
     * Live payout: transfer from Squad merchant wallet to worker's real bank account.
     */
    private async livePayout(
        jobId: string,
        workerId: string,
        amount: number
    ): Promise<{ reference: string; amount: number; skipped: boolean }> {
        const bankAccount = await WorkerBankAccount.findOne({ where: { userId: workerId } });
        if (!bankAccount) {
            throw new Error('Worker has not registered a bank account. Cannot initiate payout.');
        }

        const reference = this.buildReference(workerId, jobId);

        const log = await WithdrawalLog.create({
            userId: workerId,
            squadTransactionReference: reference,
            amount,
            bankCode: bankAccount.bankCode,
            accountNumber: bankAccount.accountNumber,
            accountName: bankAccount.accountName,
            status: WITHDRAWAL_STATUS.PENDING,
            remarks: `Artivo job payout — job ${jobId}`,
        });

        try {
            const response = await this.squadService.initiateTransfer({
                transaction_reference: reference,
                amount: String(Math.round(amount * 100)),
                bank_code: bankAccount.bankCode,
                account_number: bankAccount.accountNumber,
                account_name: bankAccount.accountName,
                currency_id: 'NGN',
                remark: `Artivo job payout`,
            });

            const succeeded = response.success && (response.data as any)?.transaction_status !== 'failed';
            await WithdrawalLog.update(
                { status: succeeded ? WITHDRAWAL_STATUS.SUCCESS : WITHDRAWAL_STATUS.FAILED },
                { where: { id: log.id } }
            );
            await Job.update({ payoutReference: reference }, { where: { id: jobId } });

            return { reference, amount, skipped: false };
        } catch (err: any) {
            if (err?.statusCode === 424) {
                console.warn(`[PayoutService] Squad 424 timeout for job ${jobId}. Leaving as pending.`);
                await Job.update({ payoutReference: reference }, { where: { id: jobId } });
                return { reference, amount, skipped: false };
            }
            console.error(`[PayoutService] Squad payout failed for job ${jobId}:`, err.message);
            await WithdrawalLog.update({ status: WITHDRAWAL_STATUS.FAILED }, { where: { id: log.id } });
            throw new Error(`Payout failed: ${err.message}`);
        }
    }

    /**
     * Advance payout — same sandbox/live split.
     */
    async initiateAdvancePayout(
        workerId: string,
        amount: number,
        jobId: string,
        requestId: string
    ): Promise<{ reference: string }> {
        const reference = this.buildReference(workerId, `adv-${requestId.slice(0, 8)}`);

        if (isSandbox()) {
            await VirtualAccount.increment({ balance: amount }, { where: { userId: workerId } });
            await WithdrawalLog.create({
                userId: workerId,
                squadTransactionReference: reference,
                amount,
                bankCode: 'SANDBOX',
                accountNumber: 'VIRTUAL',
                accountName: 'Sandbox advance',
                status: WITHDRAWAL_STATUS.SUCCESS,
                remarks: `[Sandbox] advance payout — job ${jobId}`,
            });
            return { reference };
        }

        const bankAccount = await WorkerBankAccount.findOne({ where: { userId: workerId } });
        if (!bankAccount) {
            throw new Error('Worker has not registered a bank account. Cannot release advance.');
        }

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
