import { SquadErrorCode } from './types';

export class SquadError extends Error {
    public readonly code: SquadErrorCode;
    public readonly statusCode: number;
    public readonly isRetryable: boolean;
    public readonly squadMessage?: string;
    public readonly squadData?: Record<string, any>;

    constructor(
        message: string,
        code: SquadErrorCode,
        statusCode: number,
        isRetryable: boolean = false,
        squadMessage?: string,
        squadData?: Record<string, any>
    ) {
        super(message);
        this.name = 'SquadError';
        this.code = code;
        this.statusCode = statusCode;
        this.isRetryable = isRetryable;
        this.squadMessage = squadMessage;
        this.squadData = squadData;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SquadError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            isRetryable: this.isRetryable,
            squadMessage: this.squadMessage,
            squadData: this.squadData,
        };
    }
}

export class SquadValidationError extends SquadError {
    constructor(message: string, squadMessage?: string, squadData?: Record<string, any>) {
        super(message, SquadErrorCode.VALIDATION_ERROR, 400, false, squadMessage, squadData);
        this.name = 'SquadValidationError';
    }
}

export class SquadUnauthorizedError extends SquadError {
    constructor(message: string = 'Squad API authentication failed - check SQUAD_SECRET_KEY') {
        super(message, SquadErrorCode.UNAUTHORIZED, 401, false);
        this.name = 'SquadUnauthorizedError';
    }
}

export class SquadForbiddenError extends SquadError {
    constructor(message: string = 'Squad API key is invalid or lacks permissions') {
        super(message, SquadErrorCode.FORBIDDEN, 403, false);
        this.name = 'SquadForbiddenError';
    }
}

export class SquadNotFoundError extends SquadError {
    constructor(resource: string, identifier: string) {
        super(`Squad ${resource} not found: ${identifier}`, SquadErrorCode.NOT_FOUND, 404, false);
        this.name = 'SquadNotFoundError';
    }
}

export class SquadNetworkError extends SquadError {
    constructor(message: string) {
        super(`Squad API network error: ${message}`, SquadErrorCode.NETWORK_ERROR, 0, true);
        this.name = 'SquadNetworkError';
    }
}

export class SquadTimeoutError extends SquadError {
    constructor(timeoutMs: number) {
        super(`Squad API request timed out after ${timeoutMs}ms`, SquadErrorCode.TIMEOUT, 0, true);
        this.name = 'SquadTimeoutError';
    }
}

export class SquadDuplicateCustomerError extends SquadError {
    constructor(customerIdentifier: string) {
        super(`Virtual account already exists for customer: ${customerIdentifier}`, SquadErrorCode.DUPLICATE_CUSTOMER, 409, false);
        this.name = 'SquadDuplicateCustomerError';
    }
}

export class SquadBVNMismatchError extends SquadError {
    constructor(message: string) {
        super(`BVN validation failed: ${message}`, SquadErrorCode.BVN_MISMATCH, 400, false);
        this.name = 'SquadBVNMismatchError';
    }
}

export class SquadAccountLimitError extends SquadError {
    constructor(message: string = 'Merchant has reached account opening limit') {
        super(message, SquadErrorCode.ACCOUNT_LIMIT_REACHED, 422, false);
        this.name = 'SquadAccountLimitError';
    }
}

export function createSquadError(statusCode: number, responseData: any, operation: string): SquadError {
    const message = responseData?.message || 'Unknown error';
    const data = responseData?.data || {};

    if (statusCode === 422 && message.toLowerCase().includes('account opening limit')) {
        return new SquadAccountLimitError(message);
    }

    if (statusCode === 400) {
        if (message.toLowerCase().includes('bvn')) {
            return new SquadBVNMismatchError(message);
        }
        return new SquadValidationError(`Squad validation error during ${operation}: ${message}`, message, data);
    }

    if (statusCode === 401) {
        return new SquadUnauthorizedError();
    }

    if (statusCode === 403) {
        return new SquadForbiddenError(message);
    }

    if (statusCode === 404) {
        return new SquadNotFoundError(operation, 'unknown');
    }

    if (statusCode === 409 || message.toLowerCase().includes('already exists')) {
        return new SquadDuplicateCustomerError('unknown');
    }

    if (statusCode >= 500) {
        return new SquadError(`Squad server error during ${operation}: ${message}`, SquadErrorCode.UNKNOWN, statusCode, true, message, data);
    }

    return new SquadError(`Squad API error during ${operation}: ${message}`, SquadErrorCode.UNKNOWN, statusCode, false, message, data);
}
