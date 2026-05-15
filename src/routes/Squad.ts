import express from 'express';
import crypto  from 'crypto';
import { WebhookService }      from '../services/squad/WebhookService';
import { SquadWebhookPayload } from '../services/squad/types';

export const app = express.Router();

const webhookService = new WebhookService();

function verifySquadWebhook(payload: any, signature: string): boolean {
    if (!signature) return false;

    const secret = process.env.SQUAD_SECRET_KEY ?? '';
    if (!secret) {
        console.error('[Squad Webhook] SQUAD_SECRET_KEY not configured — cannot verify signature');
        return false;
    }

    try {
        const hash = crypto
            .createHmac('sha512', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        // timingSafeEqual needs equal-length buffers or it throws
        const sigBuf  = Buffer.from(signature, 'hex');
        const hashBuf = Buffer.from(hash,      'hex');
        if (sigBuf.length !== hashBuf.length) return false;

        return crypto.timingSafeEqual(hashBuf, sigBuf);
    } catch (err) {
        console.error('[Squad Webhook] Signature check threw:', err);
        return false;
    }
}

function validatePayload(payload: any): payload is SquadWebhookPayload {
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

/**
 * POST /squad/webhook
 *
 * Receives payment events from Squad. A few things worth noting on the response codes:
 *
 * - Bad signature or malformed payload → we return 200 so Squad stops retrying the bad request.
 *   We still log it at error level so the team can spot potential replay attacks.
 * - Processing error (DB down, OOM, etc.) → 500, which tells Squad to retry later.
 * - Success → 200.
 *
 * Idempotency is handled inside WebhookService via the processed_webhooks table,
 * so receiving the same event twice is completely safe.
 */
app.post('/squad/webhook', async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();

    try {
        const signature: string        = (req.headers['x-squad-signature'] as string) ?? '';
        const payload: SquadWebhookPayload = req.body;

        console.log('[Squad Webhook] Received:', {
            transaction_ref: payload?.transaction_ref,
            indicator:       payload?.transaction_indicator,
            amount:          payload?.principal_amount,
            has_signature:   !!signature,
            timestamp:       new Date().toISOString(),
        });

        if (!verifySquadWebhook(payload, signature)) {
            console.error('[Squad Webhook] Invalid or missing signature — ignoring', {
                transaction_ref: payload?.transaction_ref,
                ip: req.ip,
            });
            return res.status(200).json({ success: false, message: 'Signature invalid' });
        }

        if (!validatePayload(payload)) {
            console.warn('[Squad Webhook] Invalid payload structure — ignoring');
            return res.status(200).json({ success: false, message: 'Invalid payload' });
        }

        const result = await webhookService.process(payload);

        console.log(`[Squad Webhook] Done in ${Date.now() - startTime}ms`, {
            action:          result.action,
            transaction_ref: result.transactionRef,
        });

        return res.status(200).json({ success: true, action: result.action });

    } catch (err: any) {
        console.error(`[Squad Webhook] Unhandled error after ${Date.now() - startTime}ms:`, err?.message);
        return res.status(500).json({ success: false, message: 'Webhook processing failed — will retry' });
    }
});

app.get('/squad/webhook/health', (_req: express.Request, res: express.Response) => {
    res.status(200).json({
        success:         true,
        message:         'Squad webhook endpoint is healthy',
        signature_ready: !!process.env.SQUAD_SECRET_KEY,
        timestamp:       new Date().toISOString(),
    });
});
