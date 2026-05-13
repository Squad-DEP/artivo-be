import express from 'express';
import crypto from 'crypto';
import { PaymentService } from '../services/marketplace/PaymentService';
import { EscrowService } from '../services/marketplace/EscrowService';
import { JobService } from '../services/marketplace/JobService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { SquadWebhookPayload } from '../services/squad/types';

export const app = express.Router();

const jobRequestService = new JobRequestService();
const jobService = new JobService(jobRequestService);
const escrowService = new EscrowService();
const paymentService = new PaymentService(jobService, escrowService);

function verifySquadWebhook(payload: any, signature: string): boolean {
    if (!signature) return false;

    const secret = process.env.SQUAD_SECRET_KEY || '';
    if (!secret) {
        console.error('[Squad Webhook] SQUAD_SECRET_KEY not configured - cannot verify webhooks');
        return false;
    }

    try {
        const hash = crypto
            .createHmac('sha512', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(hash, 'hex'),
            Buffer.from(signature, 'hex')
        );
    } catch (error) {
        console.error('[Squad Webhook] Signature verification failed:', error);
        return false;
    }
}

function validateWebhookPayload(payload: any): payload is SquadWebhookPayload {
    const required = [
        'transaction_ref',
        'virtual_account_number',
        'principal_amount',
        'customer_identifier',
        'transaction_indicator',
    ];

    for (const field of required) {
        if (!payload[field]) {
            console.error(`[Squad Webhook] Missing required field: ${field}`);
            return false;
        }
    }

    return true;
}

function extractJobId(remarks: string): string | null {
    if (!remarks) return null;

    const patterns = [
        /job[_-]?id[:\s]+([a-f0-9-]+)/i,
        /for\s+job\s+([a-f0-9-]+)/i,
        /payment\s+for\s+([a-f0-9-]+)/i,
    ];

    for (const pattern of patterns) {
        const match = remarks.match(pattern);
        if (match && match[1]) return match[1];
    }

    return null;
}

async function processWebhook(payload: SquadWebhookPayload): Promise<void> {
    if (payload.transaction_indicator !== 'C') {
        console.log(`[Squad Webhook] Ignoring non-credit transaction: ${payload.transaction_ref}`);
        return;
    }

    const amount = parseFloat(payload.principal_amount);
    const jobId = extractJobId(payload.remarks);

    if (jobId) {
        // Job payment via Squad SDK — log and fund escrow
        await paymentService.logPayment({
            jobId,
            squadTransactionId: payload.transaction_ref,
            amount,
            status: 'success',
        });

        console.log(`[Squad Webhook] Payment logged and escrow funded: ${payload.transaction_ref} for job ${jobId}`, {
            amount: payload.principal_amount,
        });
        return;
    }

    // No job ID → this is a wallet top-up. Credit the user's balance.
    const credited = await escrowService.creditBalanceByIdentifier(payload.customer_identifier, amount);

    if (credited) {
        console.log(`[Squad Webhook] Wallet top-up credited: ${payload.transaction_ref}`, {
            customer_identifier: payload.customer_identifier,
            amount: payload.principal_amount,
        });
    } else {
        console.warn('[Squad Webhook] Could not credit balance — virtual account not found:', {
            customer_identifier: payload.customer_identifier,
            transaction_ref: payload.transaction_ref,
        });
    }
}

/**
 * Squad Webhook Handler
 *
 * Security: HMAC SHA512 signature verification
 * Idempotent: safe to receive the same webhook multiple times
 * Error codes:
 *   401 – invalid signature (Squad won't retry)
 *   400 – invalid payload  (Squad won't retry)
 *   500 – processing error (Squad will retry)
 *   200 – success
 */
app.post('/squad/webhook', async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();

    try {
        const signature = req.headers['x-squad-signature'] as string;
        const payload: SquadWebhookPayload = req.body;

        console.log('[Squad Webhook] Received:', {
            transaction_ref: payload?.transaction_ref,
            has_signature: !!signature,
            timestamp: new Date().toISOString(),
        });

        if (!signature) {
            console.warn('[Squad Webhook] Missing signature header');
            return res.status(401).json({ success: false, message: 'Missing webhook signature' });
        }

        if (!verifySquadWebhook(payload, signature)) {
            console.warn('[Squad Webhook] Invalid signature');
            return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
        }

        if (!validateWebhookPayload(payload)) {
            console.warn('[Squad Webhook] Invalid payload structure');
            return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
        }

        await processWebhook(payload);

        console.log(`[Squad Webhook] Processed in ${Date.now() - startTime}ms`);
        return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (error) {
        console.error(`[Squad Webhook] Failed after ${Date.now() - startTime}ms:`, error);
        return res.status(500).json({ success: false, message: 'Webhook processing failed - will retry' });
    }
});

app.get('/squad/webhook/health', (_req: express.Request, res: express.Response) => {
    res.status(200).json({
        success: true,
        message: 'Squad webhook endpoint is healthy',
        timestamp: new Date().toISOString(),
    });
});
