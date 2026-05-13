import axios, { AxiosInstance } from 'axios';
import { squadConfig } from '../../config/squad.config';
import {
    CreateVirtualAccountRequest,
    AccountLookupRequest,
    InitiateTransferRequest,
    TransferRequeryRequest,
    ListTransfersRequest,
} from './types/requests';
import {
    VirtualAccountResponse,
    VirtualAccountDetailsResponse,
    AccountLookupResponse,
    TransferResponse,
    TransactionVerifyResponse,
} from './types/responses';
import { TransactionQueryResponse } from './types/transactions';
import { WebhookErrorLogResponse } from './types/webhooks';
import { SquadError, createSquadError } from './SquadErrors';

export class SquadService {
    private client: AxiosInstance;
    private readonly maxRetries: number;
    private readonly retryDelay: number;

    constructor() {
        this.maxRetries = squadConfig.retryAttempts;
        this.retryDelay = squadConfig.retryDelay;

        this.client = axios.create({
            baseURL: squadConfig.baseUrl,
            headers: {
                'Authorization': `Bearer ${squadConfig.secretKey}`,
                'Content-Type': 'application/json',
            },
            timeout: squadConfig.timeout,
            validateStatus: () => true,
        });

        this.client.interceptors.request.use(
            (config) => {
                this.logRequest(config.method?.toUpperCase() || 'UNKNOWN', config.url || '', config.data);
                return config;
            },
            (error) => {
                this.logError('Request interceptor error', error);
                return Promise.reject(error);
            }
        );

        this.client.interceptors.response.use(
            (response) => {
                this.logResponse(
                    response.config.method?.toUpperCase() || 'UNKNOWN',
                    response.config.url || '',
                    response.status,
                    response.data
                );
                return response;
            },
            (error) => {
                this.logError('Response interceptor error', error);
                return Promise.reject(error);
            }
        );
    }

    // =========================================================================
    // VIRTUAL ACCOUNT
    // =========================================================================

    async createVirtualAccount(data: CreateVirtualAccountRequest): Promise<VirtualAccountResponse> {
        return this.executeWithRetry(
            async () => {
                const response = await this.client.post<VirtualAccountResponse>('/virtual-account', data);
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'create virtual account');
            },
            'createVirtualAccount',
            true
        );
    }

    async getVirtualAccount(customerIdentifier: string): Promise<VirtualAccountDetailsResponse> {
        if (!customerIdentifier) {
            throw new SquadError('Customer identifier is required', 'VALIDATION_ERROR' as any, 400, false);
        }
        return this.executeWithRetry(
            async () => {
                const response = await this.client.get<VirtualAccountDetailsResponse>(
                    `/virtual-account/${customerIdentifier}`
                );
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'get virtual account');
            },
            'getVirtualAccount',
            true
        );
    }

    async getCustomerTransactions(customerIdentifier: string): Promise<TransactionQueryResponse> {
        if (!customerIdentifier) {
            throw new SquadError('Customer identifier is required', 'VALIDATION_ERROR' as any, 400, false);
        }
        return this.executeWithRetry(
            async () => {
                const response = await this.client.get<TransactionQueryResponse>(
                    `/virtual-account/customer/transactions/${customerIdentifier}`
                );
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'query customer transactions');
            },
            'getCustomerTransactions',
            true
        );
    }

    async getWebhookErrorLogs(): Promise<WebhookErrorLogResponse> {
        return this.executeWithRetry(
            async () => {
                const response = await this.client.get<WebhookErrorLogResponse>(
                    '/virtual-account/webhook/logs'
                );
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'get webhook error logs');
            },
            'getWebhookErrorLogs',
            true
        );
    }

    // =========================================================================
    // PAYMENT (CHECKOUT)
    // =========================================================================

    /**
     * GET /transaction/verify/:transaction_ref
     * Verify the status of a payment by its transaction reference.
     */
    async verifyTransaction(transactionRef: string): Promise<TransactionVerifyResponse> {
        if (!transactionRef) {
            throw new SquadError('Transaction reference is required', 'VALIDATION_ERROR' as any, 400, false);
        }
        return this.executeWithRetry(
            async () => {
                const response = await this.client.get<TransactionVerifyResponse>(
                    `/transaction/verify/${transactionRef}`
                );
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'verify transaction');
            },
            'verifyTransaction',
            true
        );
    }

    // =========================================================================
    // PAYOUT / TRANSFER
    // =========================================================================

    /**
     * POST /payout/account/lookup
     * Verify a recipient's account name before transferring.
     * Always call this before initiateTransfer.
     */
    async lookupAccount(data: AccountLookupRequest): Promise<AccountLookupResponse> {
        return this.executeWithRetry(
            async () => {
                const response = await this.client.post<AccountLookupResponse>(
                    '/payout/account/lookup',
                    data
                );
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'account lookup');
            },
            'lookupAccount',
            true
        );
    }

    /**
     * POST /payout/transfer
     * Move funds from the Squad ledger to a Nigerian bank account.
     * - transaction_reference must be in format: MERCHANTID_REFERENCE
     * - amount must be a string in kobo
     * - account_name must be the verified name from lookupAccount
     */
    async initiateTransfer(data: InitiateTransferRequest): Promise<TransferResponse> {
        return this.executeWithRetry(
            async () => {
                const response = await this.client.post<TransferResponse>('/payout/transfer', data);
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'initiate transfer');
            },
            'initiateTransfer',
            false
        );
    }

    /**
     * POST /payout/requery
     * Re-check the outcome of a transfer — critical after a 424 timeout.
     */
    async requeryTransfer(data: TransferRequeryRequest): Promise<TransferResponse> {
        return this.executeWithRetry(
            async () => {
                const response = await this.client.post<TransferResponse>('/payout/requery', data);
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'requery transfer');
            },
            'requeryTransfer',
            true
        );
    }

    /**
     * POST /payout/list
     * Paginated history of all transfers from the Squad ledger.
     */
    async listTransfers(data: ListTransfersRequest = {}): Promise<any> {
        return this.executeWithRetry(
            async () => {
                const response = await this.client.post('/payout/list', {
                    page: data.page ?? 1,
                    per_page: data.per_page ?? 20,
                    dir: data.dir ?? 'DESC',
                });
                if (response.status >= 200 && response.status < 300 && response.data.success) {
                    return response.data;
                }
                throw createSquadError(response.status, response.data, 'list transfers');
            },
            'listTransfers',
            true
        );
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string,
        isIdempotent: boolean
    ): Promise<T> {
        let lastError: Error | null = null;
        let attempt = 0;

        while (attempt <= this.maxRetries) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                attempt++;

                if (error instanceof SquadError && !error.isRetryable) {
                    throw error;
                }

                if (!isIdempotent && attempt > 1) {
                    throw error;
                }

                if (attempt <= this.maxRetries && this.shouldRetry(error)) {
                    const delay = this.calculateBackoff(attempt);
                    this.logRetry(operationName, attempt, this.maxRetries, delay);
                    await this.sleep(delay);
                    continue;
                }

                throw error;
            }
        }

        throw lastError || new Error(`Failed after ${this.maxRetries} retries`);
    }

    private shouldRetry(error: any): boolean {
        if (error instanceof SquadError) return error.isRetryable;

        if (axios.isAxiosError(error)) {
            if (!error.response) return true;
            if (error.response.status >= 500) return true;
            if (error.response.status === 429) return true;
        }

        return false;
    }

    private calculateBackoff(attempt: number): number {
        const exponentialDelay = this.retryDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000;
        return Math.min(exponentialDelay + jitter, 30000);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private logRequest(method: string, url: string, data?: any): void {
        console.log(`[Squad API] ${method} ${url}`, {
            timestamp: new Date().toISOString(),
            data: this.sanitizeLogData(data),
        });
    }

    private logResponse(method: string, url: string, status: number, data?: any): void {
        const logFn = status >= 400 ? console.error : console.log;
        logFn(`[Squad API] ${method} ${url} - ${status}`, {
            timestamp: new Date().toISOString(),
            status,
            success: status >= 200 && status < 300,
            data: this.sanitizeLogData(data),
        });
    }

    private logError(context: string, error: any): void {
        console.error(`[Squad API Error] ${context}`, {
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
    }

    private logRetry(operation: string, attempt: number, maxRetries: number, delay: number): void {
        console.warn(`[Squad API Retry] ${operation} - Attempt ${attempt}/${maxRetries}`, {
            timestamp: new Date().toISOString(),
            retryAfterMs: delay,
        });
    }

    private sanitizeLogData(data: any): any {
        if (!data) return data;
        const sanitized = { ...data };
        const sensitiveFields = ['bvn', 'dob', 'beneficiary_account', 'mobile_num'];
        sensitiveFields.forEach((field) => {
            if (sanitized[field]) sanitized[field] = '***REDACTED***';
        });
        return sanitized;
    }

    static isConfigured(): boolean {
        return !!squadConfig.secretKey && !!squadConfig.baseUrl;
    }

    static getConfig() {
        return {
            baseUrl: squadConfig.baseUrl,
            hasSecretKey: !!squadConfig.secretKey,
            timeout: squadConfig.timeout,
            retryAttempts: squadConfig.retryAttempts,
            retryDelay: squadConfig.retryDelay,
        };
    }
}
