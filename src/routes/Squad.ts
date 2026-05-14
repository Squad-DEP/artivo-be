import express from 'express';
import crypto from 'crypto';
import { PaymentService } from '../services/marketplace/PaymentService';
import { JobService } from '../services/marketplace/JobService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { SquadWebhookPayload } from '../services/squad/types';

export const app = express.Router();

// Initialize services
const jobRequestService = new JobRequestService();
const jobService = new JobService(jobRequestService);
const paymentService = new PaymentService(jobService);

/**
 * Verify Squad webhook signature using HMAC SHA512
 * This ensures the webhook actually came from Squad
 */
function verifySquadWebhook(payload: any, signature: string): boolean {
    if (!signature) {
        return false;
    }

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

        // Constant-time comparison to prevent timing attacks
        return crypto.timingSafeEqual(
            Buffer.from(hash, 'hex'),
            Buffer.from(signature, 'hex'),
        );
    } catch (error) {
        console.error('[Squad Webhook] Signature verification failed:', error);
        return false;
    }
}

/**
 * Validate webhook payload structure
 */
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

/**
 * Extract job ID from webhook remarks
 * Supports formats: "job_id: abc123", "job-id: abc123", "jobid: abc123"
 */
function extractJobId(remarks: string): string | null {
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

/**
 * Process webhook payload and log payment
 */
async function processWebhook(payload: SquadWebhookPayload): Promise<void> {
    // Only process credit transactions (money received)
    if (payload.transaction_indicator !== 'C') {
        console.log(`[Squad Webhook] Ignoring non-credit transaction: ${payload.transaction_ref}`);
        return;
    }

    // Extract job ID from remarks
    const jobId = extractJobId(payload.remarks);

    if (!jobId) {
        console.warn('[Squad Webhook] No job ID found in remarks:', {
            transaction_ref: payload.transaction_ref,
            remarks: payload.remarks,
        });
        return;
    }

    // Log payment
    try {
        await paymentService.logPayment({
            jobId,
            squadTransactionId: payload.transaction_ref,
            amount: parseFloat(payload.principal_amount),
            status: 'success',
        });

        console.log(`[Squad Webhook] ✅ Payment logged: ${payload.transaction_ref} for job ${jobId}`, {
            amount: payload.principal_amount,
            settled: payload.settled_amount,
            fee: payload.fee_charged,
        });
    } catch (error) {
        console.error(`[Squad Webhook] ❌ Failed to log payment for job ${jobId}:`, error);
        throw error; // Re-throw to trigger webhook retry from Squad
    }
}

/**
 * Squad Webhook Handler
 * Receives payment notifications from Squad
 * 
 * Security:
 * - Validates webhook signature (HMAC SHA512)
 * - Validates payload structure
 * - Idempotent: Safe to receive same webhook multiple times
 * 
 * Error Handling:
 * - Returns 401 for invalid signatures (Squad won't retry)
 * - Returns 400 for invalid payloads (Squad won't retry)
 * - Returns 500 for processing errors (Squad will retry)
 * - Returns 200 for successful processing
 */
app.post('/squad/webhook', async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();

    try {
        const signature = req.headers['x-squad-signature'] as string;
        const payload: SquadWebhookPayload = req.body;

        console.log('[Squad Webhook] Received webhook:', {
            transaction_ref: payload?.transaction_ref,
            has_signature: !!signature,
            timestamp: new Date().toISOString(),
        });

        // Step 1: Verify webhook signature
        if (!signature) {
            console.warn('[Squad Webhook] Missing signature header');
            return res.status(401).json({
                success: false,
                message: 'Missing webhook signature',
            });
        }

        if (!verifySquadWebhook(payload, signature)) {
            console.warn('[Squad Webhook] Invalid signature - possible attack or misconfiguration');
            return res.status(401).json({
                success: false,
                message: 'Invalid webhook signature',
            });
        }

        // Step 2: Validate payload structure
        if (!validateWebhookPayload(payload)) {
            console.warn('[Squad Webhook] Invalid payload structure');
            return res.status(400).json({
                success: false,
                message: 'Invalid webhook payload',
            });
        }

        // Step 3: Process webhook
        await processWebhook(payload);

        // Step 4: Return success
        const duration = Date.now() - startTime;
        console.log(`[Squad Webhook] ✅ Processed successfully in ${duration}ms`);

        return res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Squad Webhook] ❌ Processing failed after ${duration}ms:`, error);

        // Return 500 to trigger Squad's retry mechanism
        return res.status(500).json({
            success: false,
            message: 'Webhook processing failed - will retry',
        });
    }
});

/**
 * Health check endpoint for Squad webhook
 * Use this to verify webhook URL is accessible
 */
app.get('/squad/webhook/health', (req: express.Request, res: express.Response) => {
    res.status(200).json({
        success: true,
        message: 'Squad webhook endpoint is healthy',
        timestamp: new Date().toISOString(),
    });
});
