export enum SquadErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    DUPLICATE_CUSTOMER = 'DUPLICATE_CUSTOMER',
    BVN_MISMATCH = 'BVN_MISMATCH',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT = 'TIMEOUT',
    UNKNOWN = 'UNKNOWN',
}

export interface SquadConfig {
    baseUrl: string;
    secretKey: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
}
