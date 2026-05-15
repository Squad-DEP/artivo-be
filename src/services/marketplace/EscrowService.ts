import sequelize from '../../providers/db';
import { Transaction } from 'sequelize';
import { EscrowEntry, EscrowEntryModel } from '../../models/EscrowEntry';
import { EscrowAdvanceRequest, EscrowAdvanceRequestModel } from '../../models/EscrowAdvanceRequest';
import { Job } from '../../models/Job';
import { VirtualAccount } from '../../models/VirtualAccount';
import { ADVANCE_REQUEST_STATUS, ESCROW_STATUS, USER_ROLE } from '../../constants/statuses';

export interface CreateEscrowDTO {
    jobId: string;
    customerId: string;
    workerId: string;
    amount: number;
}

export class EscrowService {
    async createEscrow(data: CreateEscrowDTO, t?: Transaction): Promise<EscrowEntryModel> {
        return EscrowEntry.create({
            jobId: data.jobId,
            customerId: data.customerId,
            workerId: data.workerId,
            amount: data.amount,
            status: ESCROW_STATUS.PENDING,
        }, { transaction: t });
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
     * Accepts an optional external transaction so callers can compose this into
     * a larger atomic operation (e.g. hire flow).
     * Returns { ok: false } if insufficient funds. Throws on DB error.
     */
    async checkAndDeductBalance(
        userId: string,
        amount: number,
        externalTx?: Transaction
    ): Promise<{ ok: boolean; balance: number }> {
        const run = async (t: Transaction) => {
            const account = await VirtualAccount.findOne({ where: { userId }, transaction: t, lock: true });
            if (!account) throw new Error('Virtual account not found');

            const available = Number(account.balance);
            if (available < amount) return { ok: false, balance: available };

            await VirtualAccount.increment({ balance: -amount }, { where: { userId }, transaction: t });
            return { ok: true, balance: available - amount };
        };

        if (externalTx) return run(externalTx);
        return sequelize.transaction(run);
    }

    /**
     * Create an EscrowEntry already in FUNDED state within a transaction.
     * Use this during hire so balance deduction and escrow creation are atomic.
     */
    async createEscrowFunded(data: CreateEscrowDTO, t: Transaction): Promise<EscrowEntryModel> {
        return EscrowEntry.create({
            jobId: data.jobId,
            customerId: data.customerId,
            workerId: data.workerId,
            amount: data.amount,
            status: ESCROW_STATUS.FUNDED,
            fundedAt: new Date(),
        }, { transaction: t });
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
     * When BOTH confirm, escrow is atomically released and the worker receives
     * only the remainder (total escrow minus already-approved advances).
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
        if (role === USER_ROLE.WORKER) update.workerConfirmed = true;
        if (role === USER_ROLE.CUSTOMER) update.customerConfirmed = true;

        await EscrowEntry.update(update, { where: { jobId } });

        const updated = await this.getEscrowByJobId(jobId);
        if (!updated) throw new Error('Escrow disappeared during update');

        const workerDone = updated.workerConfirmed ?? false;
        const customerDone = updated.customerConfirmed ?? false;

        if (workerDone && customerDone) {
            // Mark escrow released — actual payout is handled by PayoutService in the route layer
            await EscrowEntry.update(
                { status: ESCROW_STATUS.RELEASED, releasedAt: new Date() },
                { where: { jobId } }
            );
            return { workerConfirmed: true, customerConfirmed: true, released: true };
        }

        return { workerConfirmed: workerDone, customerConfirmed: customerDone, released: false };
    }

    /**
     * Release escrow to the worker.
     * For internal/admin use. Normal flow goes through confirmCompletion.
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

    /**
     * Worker requests an advance from the escrow (e.g. for materials).
     * Amount must not exceed total escrow minus already-approved advances.
     */
    async requestAdvance(
        jobId: string,
        workerId: string,
        amount: number,
        reason?: string
    ): Promise<EscrowAdvanceRequestModel> {
        const job = await Job.findByPk(jobId);
        if (!job) throw new Error('Job not found');
        if (job.workerId !== workerId) throw new Error('Not assigned to this job');
        if (job.status !== 'in_progress') throw new Error('Job must be in progress to request an advance');

        const escrow = await this.getEscrowByJobId(jobId);
        if (!escrow || escrow.status !== ESCROW_STATUS.FUNDED) {
            throw new Error('Escrow must be funded before requesting an advance');
        }

        // Sum previously approved advances
        const approved = await EscrowAdvanceRequest.findAll({
            where: { jobId, status: ADVANCE_REQUEST_STATUS.APPROVED },
        });
        const alreadyReleased = approved.reduce((sum, r) => sum + Number(r.amount), 0);
        const remaining = Number(escrow.amount) - alreadyReleased;

        if (amount > remaining) {
            throw new Error(`Advance of ₦${amount} exceeds remaining escrow of ₦${remaining}`);
        }

        return EscrowAdvanceRequest.create({
            jobId,
            workerId,
            customerId: escrow.customerId,
            amount,
            reason: reason ?? null,
            status: ADVANCE_REQUEST_STATUS.PENDING,
        });
    }

    async getAdvanceRequests(jobId: string): Promise<EscrowAdvanceRequestModel[]> {
        return EscrowAdvanceRequest.findAll({
            where: { jobId },
            order: [['requestedAt', 'DESC']],
        });
    }

    /**
     * Customer approves an advance request — credits worker balance immediately.
     */
    async approveAdvance(requestId: string, customerId: string): Promise<EscrowAdvanceRequestModel> {
        const request = await EscrowAdvanceRequest.findByPk(requestId);
        if (!request) throw new Error('Advance request not found');
        if (request.customerId !== customerId) throw new Error('Not authorised to approve this request');
        if (request.status !== ADVANCE_REQUEST_STATUS.PENDING) {
            throw new Error(`Request is already ${request.status}`);
        }

        await EscrowAdvanceRequest.update(
            { status: ADVANCE_REQUEST_STATUS.APPROVED, approvedAt: new Date() },
            { where: { id: requestId } }
        );

        // Payout is handled by the route layer (PayoutService.initiateAdvancePayout)
        return (await EscrowAdvanceRequest.findByPk(requestId))!;
    }

    async rejectAdvance(requestId: string, customerId: string): Promise<EscrowAdvanceRequestModel> {
        const request = await EscrowAdvanceRequest.findByPk(requestId);
        if (!request) throw new Error('Advance request not found');
        if (request.customerId !== customerId) throw new Error('Not authorised to reject this request');
        if (request.status !== ADVANCE_REQUEST_STATUS.PENDING) {
            throw new Error(`Request is already ${request.status}`);
        }

        await EscrowAdvanceRequest.update(
            { status: ADVANCE_REQUEST_STATUS.REJECTED },
            { where: { id: requestId } }
        );

        return (await EscrowAdvanceRequest.findByPk(requestId))!;
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
