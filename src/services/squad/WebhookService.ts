import { PaymentService }       from '../marketplace/PaymentService';
import { EscrowService }        from '../marketplace/EscrowService';
import { JobService }           from '../marketplace/JobService';
import { JobRequestService }    from '../marketplace/JobRequestService';
import { ProcessedWebhookRepository } from '../../repositories/ProcessedWebhookRepository';
import { SquadWebhookPayload }  from './types/webhooks';
import { PAYMENT_STATUS }       from '../../constants/statuses';

export interface WebhookProcessResult {
    alreadyProcessed: boolean;
    action:           'job_payment' | 'wallet_topup' | 'skipped' | 'duplicate';
    transactionRef:   string;
}

/**
 * Single place that handles all inbound Squad webhook payloads.
 * Both the live webhook route and the recovery service call this,
 * so the logic never has to be written twice.
 *
 * Idempotency is enforced here via the processed_webhooks table.
 * Every transaction_ref is written there on first processing; any
 * subsequent call for the same ref returns early without side effects.
 */
export class WebhookService {
    private paymentService:  PaymentService;
    private escrowService:   EscrowService;
    private processedWebhookRepo: ProcessedWebhookRepository;

    constructor(paymentService?: PaymentService, escrowService?: EscrowService, processedWebhookRepo = new ProcessedWebhookRepository()) {
        const jobRequestService      = new JobRequestService();
        const jobService             = new JobService(jobRequestService);
        this.escrowService           = escrowService  ?? new EscrowService();
        this.paymentService          = paymentService ?? new PaymentService(jobService, this.escrowService);
        this.processedWebhookRepo    = processedWebhookRepo;
    }

    async process(payload: SquadWebhookPayload): Promise<WebhookProcessResult> {
        const ref = payload.transaction_ref;

        // Idempotency: bail out early if we've already handled this transaction.
        const alreadySeen = await this.processedWebhookRepo.findByRef(ref);
        if (alreadySeen) {
            console.log(`[WebhookService] Already processed — skipping: ${ref}`);
            return { alreadyProcessed: true, action: 'duplicate', transactionRef: ref };
        }

        // Squad sends debits too (e.g. transfer confirmations). We only care about credits.
        if (payload.transaction_indicator !== 'C') {
            console.log(`[WebhookService] Non-credit transaction, ignoring: ${ref}`);
            await this.markProcessed(ref);
            return { alreadyProcessed: false, action: 'skipped', transactionRef: ref };
        }

        const amount = parseFloat(payload.principal_amount);
        const jobId  = this.extractJobId(payload.remarks);

        if (jobId) {
            // Payment came in with a job ID in the remarks — this funds the escrow for that job.
            await this.paymentService.logPayment({
                jobId,
                squadTransactionId: ref,
                amount,
                status: PAYMENT_STATUS.SUCCESS,
            });
            await this.markProcessed(ref);
            console.log(`[WebhookService] Job payment logged — ref ${ref}, job ${jobId}, ₦${amount}`);
            return { alreadyProcessed: false, action: 'job_payment', transactionRef: ref };
        }

        // No job ID in remarks — general wallet top-up, credit the user's balance.
        const credited = await this.escrowService.creditBalanceByIdentifier(
            payload.customer_identifier,
            amount,
        );
        await this.markProcessed(ref);

        if (credited) {
            console.log(`[WebhookService] Wallet top-up — ref ${ref}, identifier ${payload.customer_identifier}, ₦${amount}`);
        } else {
            console.warn(`[WebhookService] Virtual account not found for identifier ${payload.customer_identifier} — ref ${ref}`);
        }

        return { alreadyProcessed: false, action: 'wallet_topup', transactionRef: ref };
    }

    private async markProcessed(transactionRef: string): Promise<void> {
        await this.processedWebhookRepo.markProcessed(transactionRef);
    }

    private extractJobId(remarks: string): string | null {
        if (!remarks) return null;
        const patterns = [
            /job[_-]?id[:\s]+([a-f0-9-]+)/i,
            /for\s+job\s+([a-f0-9-]+)/i,
            /payment\s+for\s+([a-f0-9-]+)/i,
        ];
        for (const pattern of patterns) {
            const match = remarks.match(pattern);
            if (match?.[1]) return match[1];
        }
        return null;
    }
}
