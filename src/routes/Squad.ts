import express from 'express';
import { PaymentService } from '../services/marketplace/PaymentService';
import { JobService } from '../services/marketplace/JobService';
import { JobRequestService } from '../services/marketplace/JobRequestService';

export const app = express.Router();

// Initialize services
const jobRequestService = new JobRequestService();
const jobService = new JobService(jobRequestService);
const paymentService = new PaymentService(jobService);

/**
 * Squad Webhook Handler
 * Receives payment notifications from Squad for verification
 * 
 * Frontend handles payment initiation, this just logs confirmations
 */
app.post('/squad/webhook', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const {
            transaction_ref,
            principal_amount,
            transaction_indicator,
            remarks,
        } = req.body;

        console.log('Squad webhook received:', req.body);

        // Extract job_id from remarks if present
        const jobIdMatch = remarks?.match(/job[_-]?id[:\s]+([a-f0-9-]+)/i);
        const jobId = jobIdMatch ? jobIdMatch[1] : null;

        if (jobId && transaction_indicator === 'C') {
            // Update payment status if needed
            await paymentService.logPayment({
                jobId,
                squadTransactionId: transaction_ref,
                amount: parseFloat(principal_amount),
                status: 'success',
            });
        }

        // Always return 200 to Squad
        return res.status(200).json({ msg: 'Webhook received' });
    } catch (error) {
        console.error('Squad webhook error:', error);
        return res.status(200).json({ msg: 'Webhook received with errors' });
    }
});
