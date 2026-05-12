import { SquadConfig } from '../services/squad/types';

export const squadConfig: SquadConfig = {
    baseUrl: process.env.SQUAD_BASE_URL || 'https://sandbox-api-d.squadco.com',
    secretKey: process.env.SQUAD_SECRET_KEY || '',
    timeout: parseInt(process.env.SQUAD_TIMEOUT || '30000', 10), // 30 seconds default
    retryAttempts: parseInt(process.env.SQUAD_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.SQUAD_RETRY_DELAY || '1000', 10), // 1 second default
};

/**
 * Validate Squad configuration
 */
export function validateSquadConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!squadConfig.secretKey) {
        errors.push('SQUAD_SECRET_KEY is not configured');
    }

    if (!squadConfig.baseUrl) {
        errors.push('SQUAD_BASE_URL is not configured');
    }

    if (squadConfig.timeout < 1000) {
        errors.push('SQUAD_TIMEOUT must be at least 1000ms');
    }

    if (squadConfig.retryAttempts < 0 || squadConfig.retryAttempts > 5) {
        errors.push('SQUAD_RETRY_ATTEMPTS must be between 0 and 5');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Check if Squad is configured and ready to use
 */
export function isSquadConfigured(): boolean {
    return !!squadConfig.secretKey && !!squadConfig.baseUrl;
}
