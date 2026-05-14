import type { EscrowStatus } from '../models/EscrowEntry';
import type { AdvanceRequestStatus } from '../models/EscrowAdvanceRequest';
import type { JobStatus } from '../models/Job';
import type { JobRequestStatus } from '../models/JobRequest';
import type { WithdrawalStatus } from '../models/WithdrawalLog';

export const ESCROW_STATUS: Record<Uppercase<EscrowStatus>, EscrowStatus> = {
    PENDING: 'pending',
    FUNDED: 'funded',
    RELEASED: 'released',
    REFUNDED: 'refunded',
    DISPUTED: 'disputed',
} as const;

export const JOB_STATUS: Record<Uppercase<JobStatus>, JobStatus> = {
    PENDING: 'pending',
    PENDING_PAYMENT: 'pending_payment',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    PAID: 'paid',
} as const;

export const JOB_REQUEST_STATUS: Record<Uppercase<JobRequestStatus>, JobRequestStatus> = {
    OPEN: 'open',
    ASSIGNED: 'assigned',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
} as const;

export const WITHDRAWAL_STATUS: Record<Uppercase<WithdrawalStatus>, WithdrawalStatus> = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
} as const;

/** Status values Squad returns on a transaction. */
export const SQUAD_TX_STATUS = {
    SUCCESS: 'success',
    FAILED: 'failed',
    PENDING: 'pending',
} as const;

/** Status values stored in our payment_logs table. */
export const PAYMENT_STATUS = {
    SUCCESS: 'success',
    COMPLETED: 'completed',
    FAILED: 'failed',
    PENDING: 'pending',
} as const;

export const ADVANCE_REQUEST_STATUS: Record<Uppercase<AdvanceRequestStatus>, AdvanceRequestStatus> = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
} as const;

export const USER_ROLE = {
    WORKER: 'worker',
    CUSTOMER: 'customer',
} as const;
