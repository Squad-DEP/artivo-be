import { body, query, param, validationResult } from 'express-validator';
import passport from './../providers/Passport';
import express from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { WorkerService } from '../services/marketplace/WorkerService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { JobService } from '../services/marketplace/JobService';
import { PaymentService } from '../services/marketplace/PaymentService';
import { EscrowService } from '../services/marketplace/EscrowService';
import { ReviewService } from '../services/marketplace/ReviewService';
import { PayoutService } from '../services/marketplace/PayoutService';
import MatchingService from '../services/matching/MatchingService';

export const app = express.Router();

const workerService = new WorkerService();
const jobRequestService = new JobRequestService();
const jobService = new JobService(jobRequestService);
const escrowService = new EscrowService();
const paymentService = new PaymentService(jobService, escrowService);
const reviewService = new ReviewService();
const payoutService = new PayoutService();
const matchingService = MatchingService;

const customerController = new CustomerController(
    workerService,
    jobRequestService,
    jobService,
    paymentService,
    escrowService,
    reviewService,
    matchingService,
);

/**
 * @swagger
 * tags:
 *   - name: Customer
 *     description: Customer marketplace endpoints
 */

app.get('/customer/feed', [
    passport.authenticate('jwt', { session: false }),
    query('job_type_id').optional(),
    query('location').optional(),
    query('query').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.getFeed(req, res, next);
});

app.post('/customer/request-job', [
    passport.authenticate('jwt', { session: false }),
    body('job_type_id').exists().isUUID(),
    body('title').exists().trim().notEmpty(),
    body('description').exists().trim().notEmpty(),
    body('location').optional().trim(),
    body('budget').optional().isFloat({ min: 0 }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.requestJob(req, res, next);
});

app.post('/customer/hire', [
    passport.authenticate('jwt', { session: false }),
    // Accept either (job_request_id + worker_id + amount) or proposal_id alone
    body('proposal_id').optional().isUUID(),
    body('job_request_id').if(body('proposal_id').not().exists()).exists().isUUID(),
    body('worker_id').if(body('proposal_id').not().exists()).exists().isUUID(),
    body('amount').if(body('proposal_id').not().exists()).exists().isFloat({ min: 0 }),
    body('payment_method').optional().isIn(['online', 'offline']),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.hire(req, res, next);
});

app.get('/customer/job-requests/:id/proposals', [
    passport.authenticate('jwt', { session: false }),
    param('id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.getJobRequestProposals(req, res, next);
});

/**
 * @openapi
 * /customer/verify-payment:
 *   post:
 *     description: >
 *       Verify a Squad transaction server-side and log the payment.
 *       Call this after the customer completes payment on the frontend.
 *       The backend fetches the transaction from Squad, confirms the amount
 *       matches the job, and funds the escrow entry.
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - job_id
 *               - transaction_reference
 *             properties:
 *               job_id:
 *                 type: string
 *               transaction_reference:
 *                 type: string
 *                 description: The Squad transaction reference returned after payment
 *     responses:
 *       200:
 *         description: Payment verified and logged
 *       400:
 *         description: Verification failed (transaction not found, amount mismatch, etc.)
 *       404:
 *         description: Job not found
 */
app.post('/customer/verify-payment', [
    passport.authenticate('jwt', { session: false }),
    body('job_id').exists().isUUID(),
    body('transaction_reference').exists().trim().notEmpty(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.verifyPayment(req, res, next);
});

app.post('/customer/complete-job/:job_id', [
    passport.authenticate('jwt', { session: false }),
    param('job_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.completeJob(req, res, next);
});

app.post('/customer/rate', [
    passport.authenticate('jwt', { session: false }),
    body('job_id').exists().isUUID(),
    body('rating').exists().isInt({ min: 1, max: 5 }),
    body('comment').optional().trim(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.rateWorker(req, res, next);
});

app.get('/customer/my-job-requests', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return customerController.getMyJobRequests(req, res, next);
});

app.get('/customer/my-jobs', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return customerController.getMyJobs(req, res, next);
});

/**
 * @openapi
 * /jobs/stats/customer:
 *   get:
 *     description: Get job statistics for the authenticated customer
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer job statistics
 */
app.get('/customer/advance-requests/:job_id', [
    passport.authenticate('jwt', { session: false }),
    param('job_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const requests = await escrowService.getAdvanceRequests(req.params.job_id);
        return res.json({ advance_requests: requests });
    } catch (error) {
        return next(error);
    }
});

app.post('/customer/approve-advance/:request_id', [
    passport.authenticate('jwt', { session: false }),
    param('request_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const request = await escrowService.approveAdvance(req.params.request_id, req.user.id);

        // Transfer advance amount directly to worker's bank via Squad
        const payout = await payoutService.initiateAdvancePayout(
            request.workerId,
            Number(request.amount),
            request.jobId,
            request.id
        );

        return res.json({ advance_request: request, payout_reference: payout.reference });
    } catch (error: any) {
        if (error.message?.includes('Not authorised') || error.message?.includes('already')) {
            return res.status(400).json({ msg: error.message });
        }
        if (error.message?.includes('bank account')) {
            return res.status(400).json({ msg: error.message });
        }
        return next(error);
    }
});

app.post('/customer/reject-advance/:request_id', [
    passport.authenticate('jwt', { session: false }),
    param('request_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const request = await escrowService.rejectAdvance(req.params.request_id, req.user.id);
        return res.json({ advance_request: request });
    } catch (error: any) {
        if (error.message?.includes('Not authorised') || error.message?.includes('already')) {
            return res.status(400).json({ msg: error.message });
        }
        return next(error);
    }
});

app.get('/jobs/stats/customer', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const stats = await jobService.getCustomerStats(req.user.id);
        return res.json(stats);
    } catch (error) {
        return next(error);
    }
});
