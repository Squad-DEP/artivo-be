import { EscrowEntry, EscrowEntryModel } from '../../models/EscrowEntry';
import { ESCROW_STATUS } from '../../constants/statuses';

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
     * Release escrow to the worker once the job is confirmed complete.
     * Called when the customer marks the job as completed.
     */
    async releaseEscrow(jobId: string): Promise<EscrowEntryModel | null> {
        const escrow = await this.getEscrowByJobId(jobId);
        if (!escrow) return null;

        if (escrow.status === ESCROW_STATUS.RELEASED) return escrow;

        if (escrow.status !== ESCROW_STATUS.FUNDED) {
            throw new Error(`Cannot release escrow in status '${escrow.status}'. Payment must be confirmed first.`);
        }

        await EscrowEntry.update(
            { status: ESCROW_STATUS.RELEASED, releasedAt: new Date() },
            { where: { jobId } }
        );

        return this.getEscrowByJobId(jobId);
    }

    /**
     * Refund escrow to the customer (e.g. job cancelled before payment, or dispute resolved for customer).
     */
    async refundEscrow(jobId: string): Promise<EscrowEntryModel | null> {
        const escrow = await this.getEscrowByJobId(jobId);
        if (!escrow) return null;

        if (escrow.status === ESCROW_STATUS.REFUNDED) return escrow;

        const refundable = [ESCROW_STATUS.PENDING, ESCROW_STATUS.FUNDED, ESCROW_STATUS.DISPUTED];
        if (!refundable.includes(escrow.status as any)) {
            throw new Error(`Cannot refund escrow in status '${escrow.status}'`);
        }

        await EscrowEntry.update(
            { status: ESCROW_STATUS.REFUNDED },
            { where: { jobId } }
        );

        return this.getEscrowByJobId(jobId);
    }

    /** Flag escrow as disputed. */
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
