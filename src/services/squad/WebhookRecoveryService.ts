import { SquadService }    from './SquadService';
import { WebhookService }  from './WebhookService';

/**
 * Recovers missed webhook notifications by polling Squad's error-log endpoint.
 *
 * Use case: server was down when Squad fired a webhook. Call recoverMissedWebhooks()
 * periodically (cron) to catch up. Each payload is processed via WebhookService so
 * idempotency, deduplication, and business logic are identical to the live path.
 */
export class WebhookRecoveryService {
    private squadService:   SquadService;
    private webhookService: WebhookService;

    constructor() {
        this.squadService   = new SquadService();
        this.webhookService = new WebhookService();
    }

    async recoverMissedWebhooks(): Promise<{
        processed: number;
        skipped:   number;
        failed:    number;
        errors:    string[];
    }> {
        const result = { processed: 0, skipped: 0, failed: 0, errors: [] as string[] };

        console.log('[WebhookRecovery] Starting recovery...');

        const response = await this.squadService.getWebhookErrorLogs();
        if (!response.success || !response.data) {
            throw new Error('[WebhookRecovery] Failed to fetch webhook error logs from Squad');
        }

        const missed = response.data.rows;
        if (missed.length === 0) {
            console.log('[WebhookRecovery] No missed webhooks found');
            return result;
        }

        console.log(`[WebhookRecovery] Found ${missed.length} missed webhook(s)`);

        for (const webhook of missed) {
            try {
                const outcome = await this.webhookService.process(webhook.payload);
                if (outcome.alreadyProcessed || outcome.action === 'duplicate') {
                    result.skipped++;
                    console.log(`[WebhookRecovery] ⏭  Already processed: ${webhook.transaction_ref}`);
                } else {
                    result.processed++;
                    console.log(`[WebhookRecovery] ✅ Processed (${outcome.action}): ${webhook.transaction_ref}`);
                }
            } catch (err: any) {
                result.failed++;
                const msg = `Failed ${webhook.transaction_ref}: ${err?.message ?? err}`;
                result.errors.push(msg);
                console.error(`[WebhookRecovery] ❌ ${msg}`);
            }
        }

        console.log('[WebhookRecovery] Done:', result);
        return result;
    }
}
