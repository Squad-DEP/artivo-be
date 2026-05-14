import { SquadService } from './SquadService';
import { PaymentService } from '../../services/marketplace/PaymentService';
import { JobService } from '../../services/marketplace/JobService';
import { JobRequestService } from '../../services/marketplace/JobRequestService';
import { SquadWebhookPayload } from './types';

/**
 * Service to recover missed webhook notifications from Squad
 * 
 * Use case: If our server is down when Squad sends a webhook,
 * we can use this service to fetch missed notifications and process them.
 * 
 * Usage:
 * ```typescript
 * const recovery = new WebhookRecoveryService();
 * await recovery.recoverMissedWebhooks();
 * ```
 */
export class WebhookRecoveryService {
    private squadService: SquadService;

    private paymentService: PaymentService;

    constructor() {
        this.squadService = new SquadService();
        
        // Initialize payment service
        const jobRequestService = new JobRequestService();
        const jobService = new JobService(jobRequestService);
        this.paymentService = new PaymentService(jobService);
    }

    /**
     * Recover all missed webhook notifications
     * Call this periodically (e.g., via cron job) to ensure no payments are missed
     */
    async recoverMissedWebhooks(): Promise<{
        processed: number;
        failed: number;
        errors: string[];
    }> {
        const result = {
            processed: 0,
            failed: 0,
            errors: [] as string[],
        };

        try {
            console.log('[Webhook Recovery] Starting recovery process...');

            // Fetch missed webhooks from Squad
            const response = await this.squadService.getWebhookErrorLogs();

            if (!response.success || !response.data) {
                throw new Error('Failed to fetch webhook error logs from Squad');
            }

            const missedWebhooks = response.data.rows;

            if (missedWebhooks.length === 0) {
                console.log('[Webhook Recovery] No missed webhooks found');
                return result;
            }

            console.log(`[Webhook Recovery] Found ${missedWebhooks.length} missed webhooks`);

            // Process each missed webhook
            for (const webhook of missedWebhooks) {
                try {
                    await this.processWebhook(webhook.payload);
                    result.processed++;
                    console.log(`[Webhook Recovery] ✅ Processed: ${webhook.transaction_ref}`);
                } catch (error) {
                    result.failed++;
                    const errorMsg = `Failed to process ${webhook.transaction_ref}: ${error}`;
                    result.errors.push(errorMsg);
                    console.error(`[Webhook Recovery] ❌ ${errorMsg}`);
                }
            }

            console.log('[Webhook Recovery] Recovery complete:', result);

            return result;
        } catch (error) {
            console.error('[Webhook Recovery] Recovery process failed:', error);
            throw error;
        }
    }

    /**
     * Process a single webhook payload
     */
    private async processWebhook(payload: SquadWebhookPayload): Promise<void> {
        // Only process credit transactions
        if (payload.transaction_indicator !== 'C') {
            return;
        }

        // Extract job ID from remarks
        const jobId = this.extractJobId(payload.remarks);

        if (!jobId) {
            console.warn('[Webhook Recovery] No job ID in remarks:', payload.remarks);
            return;
        }

        // Log payment (idempotent - safe to call multiple times)
        await this.paymentService.logPayment({
            jobId,
            squadTransactionId: payload.transaction_ref,
            amount: parseFloat(payload.principal_amount),
            status: 'success',
        });
    }

    /**
     * Extract job ID from webhook remarks
     */
    private extractJobId(remarks: string): string | null {
        if (!remarks) {
            return null;
        }

        const patterns = [
            /job[_-]?id[:\s]+([a-f0-9-]+)/i,
            /for\s+job\s+([a-f0-9-]+)/i,
            /payment\s+for\s+([a-f0-9-]+)/i,
        ];

        for (const pattern of patterns) {
            const match = remarks.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    }
}
