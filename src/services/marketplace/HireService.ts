import { Transaction } from 'sequelize';
import { sequelize } from '../../providers/db';
import { JobService } from './JobService';
import { JobRequestService } from './JobRequestService';
import { EscrowService } from './EscrowService';
import { JobProposal } from '../../models/JobProposal';
import { Job, JobModel } from '../../models/Job';
import { EscrowEntryModel } from '../../models/EscrowEntry';
import { JOB_STATUS } from '../../constants/statuses';

export type HirePaymentMethod = 'online' | 'offline';

export interface HireInput {
    jobRequestId: string;
    workerId: string;
    customerId: string;
    amount: number;
    paymentMethod: HirePaymentMethod;
}

export interface HireResult {
    job: JobModel;
    escrow: EscrowEntryModel;
    requiresPayment: boolean;
}

export interface ResolvedHireInput {
    jobRequestId: string;
    workerId: string;
    amount: number;
}

export class HireService {
    constructor(
        private jobService: JobService,
        private jobRequestService: JobRequestService,
        private escrowService: EscrowService,
    ) {}

    /**
     * Resolve proposal_id → concrete jobRequestId/workerId/amount.
     * Returns null if the proposal does not exist.
     */
    async resolveProposal(proposalId: string): Promise<ResolvedHireInput | null> {
        const proposal = await JobProposal.findByPk(proposalId);
        if (!proposal) return null;
        return {
            jobRequestId: proposal.jobRequestId,
            workerId: proposal.workerId,
            amount: Number(proposal.proposedAmount),
        };
    }

    /**
     * Idempotency check: if a pending_payment job already exists for this
     * customer+job_request (e.g. payment was cancelled), return it.
     */
    async findExistingPendingJob(jobRequestId: string, customerId: string): Promise<HireResult | null> {
        const job = await Job.findOne({
            where: { jobRequestId, customerId, status: JOB_STATUS.PENDING_PAYMENT },
        });
        if (!job) return null;
        const escrow = await this.escrowService.getEscrowByJobId(job.id);
        return { job, escrow: escrow!, requiresPayment: true };
    }

    /**
     * Execute the full hire workflow inside a single DB transaction:
     * create job, set initial status, create escrow, accept/reject proposals.
     */
    async executeHire(input: HireInput): Promise<HireResult> {
        const { job, escrow } = await sequelize.transaction(async (t: Transaction) => {
            const initialStatus = input.paymentMethod === 'offline'
                ? JOB_STATUS.IN_PROGRESS
                : JOB_STATUS.PENDING_PAYMENT;

            const job = await this.jobService.createJob(
                {
                    jobRequestId: input.jobRequestId,
                    workerId: input.workerId,
                    customerId: input.customerId,
                    amount: input.amount,
                    paymentMethod: input.paymentMethod,
                },
                t
            );

            await this.jobService.updateJobStatus(job.id, initialStatus, t);

            const escrow = input.paymentMethod === 'offline'
                ? await this.escrowService.createEscrowFunded(
                    { jobId: job.id, customerId: input.customerId, workerId: input.workerId, amount: input.amount }, t
                  )
                : await this.escrowService.createEscrow(
                    { jobId: job.id, customerId: input.customerId, workerId: input.workerId, amount: input.amount }, t
                  );

            // Always resolve proposals: reject all pending ones, then accept the hired worker's.
            // This works whether we came via proposal_id or direct hire.
            await JobProposal.update(
                { status: 'rejected' },
                { where: { jobRequestId: input.jobRequestId, status: 'pending' }, transaction: t }
            );
            await JobProposal.update(
                { status: 'accepted' },
                { where: { jobRequestId: input.jobRequestId, workerId: input.workerId }, transaction: t }
            );

            return { job, escrow };
        });

        return {
            job,
            escrow,
            requiresPayment: input.paymentMethod === 'online',
        };
    }
}
