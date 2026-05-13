import sequelize from '../../providers/db';
import { EscrowEntry, EscrowEntryModel } from '../../models/EscrowEntry';
import { VirtualAccount } from '../../models/VirtualAccount';
import { ESCROW_STATUS, USER_ROLE } from '../../constants/statuses';

export interface CreateEscrowDTO {
    jobId: string;
    customerId: string;
    workerId: string;
    amount: number;
}

export class EscrowService {
    async createEscrow(data: CreateEscrowDTO): Promise<EscrowEntryModel> {
        return EscrowEntry.create({
            jobId: data.jobId,
            customerId: data.customerId,
            workerId: data.workerId,
            amount: data.amount,
            status: ESCROW_STATUS.PENDING,
        });
    }

    async getEscrowByJobId(jobId: string): Promise<EscrowEntryModel | null> {
        return EscrowEntry.findOne({ where: { jobId } });
    }

    /**
     * Credit a user's virtual account balance (called by webhook on deposit).
     * Also increments total_deposited for lifetime tracking.
     */
    async creditBalance(userId: string, amount: number): Promise<void> {
        await VirtualAccount.increment(
            { balance: amount, totalDeposited: amount },
            { where: { userId } }
        );
    }

    /**
     * Credit by customer_identifier (used in webhook where we have the identifier, not userId).
     */
    async creditBalanceByIdentifier(customerIdentifier: string, amount: number): Promise<boolean> {
        const [updated] = await VirtualAccount.increment(
            { balance: amount, totalDeposited: amount },
            { where: { customerIdentifier } }
        );
        return (updated as any) > 0;
    }

    /**
     * Check that userId has sufficient balance, then atomically deduct the amount.
     * Returns false if insufficient funds. Throws on DB error.
     */
    async checkAndDeductBalance(userId: string, amount: number): Promise<{ ok: boolean; balance: number }> {
        const result = await sequelize.transaction(async (t) => {
            const account = await VirtualAccount.findOne({ where: { userId }, transaction: t, lock: true });

            if (!account) {
                throw new Error('Virtual account not found');
            }

            const available = Number(account.balance);
            if (available < amount) {
                return { ok: false, balance: available };
            }

            await VirtualAccount.increment(
                { balance: -amount },
                { where: { userId }, transaction: t }
            );

            return { ok: true, balance: available - amount };
        });

        return result;
    }

    /**
     * Mark escrow as funded once payment is confirmed (via webhook or verification).
     * Idempotent: safe to call multiple times.
     */
    async fundEscrow(jobId: string): Promise<EscrowEntryModel | null> {
        const escrow = await this.getEscrowByJobId(jobId);
        if (!escrow) return null;

        if (escrow.status === ESCROW_STATUS.FUNDED) return escrow;

        if (escrow.status !== ESCROW_STATUS.PENDING) {
            throw new Error(`Cannot fund escrow in status '${escrow.status}'`);
        }

        await EscrowEntry.update(
            { status: ESCROW_STATUS.FUNDED, fundedAt: new Date() },
            { where: { jobId } }
        );

        return this.getEscrowByJobId(jobId);
    }

    /**
     * Record one party's confirmation that the job is done.
     * When BOTH worker and customer have confirmed, escrow is released and
     * the worker's balance is credited.
     *
     * Returns { released: true } when both have confirmed (caller should update job status).
     */
    async confirmCompletion(
        jobId: string,
        role: typeof USER_ROLE[keyof typeof USER_ROLE]
    ): Promise<{ workerConfirmed: boolean; customerConfirmed: boolean; released: boolean }> {
        const escrow = await this.getEscrowByJobId(jobId);
        if (!escrow) throw new Error('Escrow not found for this job');

        if (escrow.status === ESCROW_STATUS.RELEASED) {
            return { workerConfirmed: true, customerConfirmed: true, released: true };
        }

        if (escrow.status !== ESCROW_STATUS.FUNDED) {
            throw new Error(`Job payment must be confirmed before marking complete. Escrow is '${escrow.status}'.`);
        }

        const update: Record<string, boolean> = {};
        if (role === USER_ROLE.WORKER) update.worker_confirmed = true;
        if (role === USER_ROLE.CUSTOMER) update.customer_confirmed = true;

        await EscrowEntry.update(update, { where: { jobId } });

        const updated = await this.getEscrowByJobId(jobId);
        if (!updated) throw new Error('Escrow disappeared during update');

        const workerDone = updated.workerConfirmed ?? false;
        const customerDone = updated.customerConfirmed ?? false;

        if (workerDone && customerDone) {
            await this.releaseEscrow(jobId, updated);
            // Credit the worker's balance with the escrowed amount
            await this.creditBalance(updated.workerId, Number(updated.amount));
            return { workerConfirmed: true, customerConfirmed: true, released: true };
        }

        return { workerConfirmed: workerDone, customerConfirmed: customerDone, released: false };
    }

    /**
     * Release escrow to the worker.
     * Called internally by confirmCompletion once both parties confirm.
     */
    async releaseEscrow(jobId: string, escrow?: EscrowEntryModel | null): Promise<EscrowEntryModel | null> {
        const entry = escrow ?? await this.getEscrowByJobId(jobId);
        if (!entry) return null;

        if (entry.status === ESCROW_STATUS.RELEASED) return entry;

        if (entry.status !== ESCROW_STATUS.FUNDED) {
            throw new Error(`Cannot release escrow in status '${entry.status}'. Payment must be confirmed first.`);
        }

        await EscrowEntry.update(
            { status: ESCROW_STATUS.RELEASED, releasedAt: new Date() },
            { where: { jobId } }
        );

        return this.getEscrowByJobId(jobId);
    }

    async refundEscrow(jobId: string): Promise<EscrowEntryModel | null> {
        const escrow = await this.getEscrowByJobId(jobId);
        if (!escrow) return null;

        if (escrow.status === ESCROW_STATUS.REFUNDED) return escrow;

        const refundable = [ESCROW_STATUS.PENDING, ESCROW_STATUS.FUNDED, ESCROW_STATUS.DISPUTED];
        if (!refundable.includes(escrow.status as any)) {
            throw new Error(`Cannot refund escrow in status '${escrow.status}'`);
        }

        // If funded, return the customer's balance
        if (escrow.status === ESCROW_STATUS.FUNDED) {
            await this.creditBalance(escrow.customerId, Number(escrow.amount));
        }

        await EscrowEntry.update(
            { status: ESCROW_STATUS.REFUNDED },
            { where: { jobId } }
        );

        return this.getEscrowByJobId(jobId);
    }

    async disputeEscrow(jobId: string): Promise<EscrowEntryModel | null> {
        const escrow = await this.getEscrowByJobId(jobId);
        if (!escrow) return null;

        const disputable = [ESCROW_STATUS.FUNDED, ESCROW_STATUS.PENDING];
        if (!disputable.includes(escrow.status as any)) {
            throw new Error(`Cannot dispute escrow in status '${escrow.status}'`);
        }

        await EscrowEntry.update(
            { status: ESCROW_STATUS.DISPUTED },
            { where: { jobId } }
        );

        return this.getEscrowByJobId(jobId);
    }
}
