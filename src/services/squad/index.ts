/**
 * Squad Integration Module
 * 
 * - Automatic retries for transient failures
 * - Structured error handling
 * - Webhook signature validation
 * - Webhook recovery for missed notifications
 * - Comprehensive logging
 * - Idempotency support
 */

export { SquadService } from './SquadService';
export { VirtualAccountService } from './VirtualAccountService';
export { WebhookRecoveryService } from './WebhookRecoveryService';

export {
    SquadError,
    SquadValidationError,
    SquadUnauthorizedError,
    SquadForbiddenError,
    SquadNotFoundError,
    SquadNetworkError,
    SquadTimeoutError,
    SquadDuplicateCustomerError,
    SquadBVNMismatchError,
    createSquadError,
} from './SquadErrors';

export * from './types';
