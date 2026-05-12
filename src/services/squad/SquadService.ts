import axios, { AxiosInstance, AxiosError } from 'axios';
import { squadConfig } from '../../config/squad.config';
import {
    CreateVirtualAccountRequest,
    VirtualAccountResponse,
    GetVirtualAccountRequest,
    VirtualAccountDetails,
    SquadErrorResponse,
} from './types';

export class SquadService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: squadConfig.baseUrl,
            headers: {
                'Authorization': `Bearer ${squadConfig.secretKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
    }

    /**
     * Create a virtual account for a user
     * This should be called after email verification
     */
    async createVirtualAccount(data: CreateVirtualAccountRequest): Promise<VirtualAccountResponse> {
        try {
            const response = await this.client.post<VirtualAccountResponse>(
                '/virtual-account',
                data
            );

            if (!response.data.success) {
                throw new Error(response.data.message || 'Failed to create virtual account');
            }

            return response.data;
        } catch (error) {
            return this.handleError(error, 'create virtual account');
        }
    }

    /**
     * Get virtual account details by customer identifier
     */
    async getVirtualAccount(data: GetVirtualAccountRequest): Promise<VirtualAccountDetails> {
        try {
            const response = await this.client.get<VirtualAccountDetails>(
                `/virtual-account/lookup?customer_identifier=${data.customer_identifier}`
            );

            if (!response.data.success) {
                throw new Error(response.data.message || 'Virtual account not found');
            }

            return response.data;
        } catch (error) {
            return this.handleError(error, 'get virtual account');
        }
    }

    /**
     * Handle Squad API errors
     */
    private handleError(error: any, operation: string): never {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<SquadErrorResponse>;
            const errorMessage = axiosError.response?.data?.message || axiosError.message;
            const errorData = axiosError.response?.data;

            console.error(`Squad API Error (${operation}):`, {
                status: axiosError.response?.status,
                message: errorMessage,
                data: errorData,
            });

            throw new Error(`Squad API: ${errorMessage}`);
        }

        console.error(`Squad Service Error (${operation}):`, error);
        throw new Error(`Failed to ${operation}: ${error.message}`);
    }

    /**
     * Check if Squad is configured
     */
    static isConfigured(): boolean {
        return !!squadConfig.secretKey;
    }
}
