import { body, param, validationResult } from 'express-validator';
import passport from './../providers/Passport';
import express from 'express';
import { WorkerBankAccount } from '../models/WorkerBankAccount';
import { WorkerController } from '../controllers/WorkerController';
import { WorkerJobService } from '../services/marketplace/WorkerJobService';
import { WorkerProfileService } from '../services/marketplace/WorkerProfileService';
import { JobService } from '../services/marketplace/JobService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { EscrowService } from '../services/marketplace/EscrowService';
import { ReviewService } from '../services/marketplace/ReviewService';

export const app = express.Router();

import { SquadService } from '../services/squad/SquadService';
const squadService = new SquadService();

// Initialize services with dependency injection
const workerJobService = new WorkerJobService();
const workerProfileService = new WorkerProfileService();
const jobRequestService = new JobRequestService();
const jobService = new JobService(jobRequestService);
const escrowService = new EscrowService();
const reviewService = new ReviewService();

// Initialize controller
const workerController = new WorkerController(workerJobService, jobService, escrowService, reviewService);

/**
 * @swagger
 * tags:
 *   - name: Worker
 *     description: Worker/Artisan marketplace endpoints
 */

/**
 * @openapi
 * /worker/subscribe:
 *   post:
 *     description: Subscribe to a job type for notifications
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - job_type_id
 *             properties:
 *               job_type_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully subscribed
 */
app.post('/worker/subscribe', [
    passport.authenticate('jwt', { session: false }),
    body('job_type_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return workerController.subscribe(req, res, next);
});

/**
 * @openapi
 * /worker/unsubscribe:
 *   post:
 *     description: Unsubscribe from a job type
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - job_type_id
 *             properties:
 *               job_type_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully unsubscribed
 */
app.post('/worker/unsubscribe', [
    passport.authenticate('jwt', { session: false }),
    body('job_type_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return workerController.unsubscribe(req, res, next);
});

/**
 * @openapi
 * /worker/subscriptions:
 *   get:
 *     description: Get all job type subscriptions
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of subscriptions
 */
app.get('/worker/subscriptions', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return workerController.getSubscriptions(req, res, next);
});

/**
 * @openapi
 * /worker/jobs:
 *   get:
 *     description: Get available job requests based on subscriptions
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of available jobs
 */
app.get('/worker/jobs', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return workerController.getJobs(req, res, next);
});

/**
 * @openapi
 * /worker/accept-job:
 *   post:
 *     description: Accept a job request
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - job_request_id
 *               - proposed_amount
 *             properties:
 *               job_request_id:
 *                 type: string
 *               proposed_amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Job accepted successfully
 */
app.post('/worker/accept-job', [
    passport.authenticate('jwt', { session: false }),
    body('job_request_id').exists().isUUID(),
    body('proposed_amount').exists().isFloat({ min: 0 }),
    body('proposed_amount_max').optional().isFloat({ min: 0 }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return workerController.acceptJob(req, res, next);
});

/**
 * @openapi
 * /worker/complete-job/{job_id}:
 *   post:
 *     description: Mark job as completed by worker
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job marked as in progress
 */
app.post('/worker/complete-job/:job_id', [
    passport.authenticate('jwt', { session: false }),
    param('job_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return workerController.completeJob(req, res, next);
});

/**
 * @openapi
 * /worker/my-jobs:
 *   get:
 *     description: Get all jobs assigned to this worker
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of worker's jobs
 */
app.get('/worker/my-jobs', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return workerController.getMyJobs(req, res, next);
});

/**
 * @openapi
 * /worker/rate-customer:
 *   post:
 *     description: Rate a customer after job completion
 *     tags: [Worker]
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
 *               - rating
 *             properties:
 *               job_id:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer rated successfully
 */
app.post('/worker/rate-customer', [
    passport.authenticate('jwt', { session: false }),
    body('job_id').exists().isUUID(),
    body('rating').exists().isInt({ min: 1, max: 5 }),
    body('comment').optional().trim(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return workerController.rateCustomer(req, res, next);
});

/**
 * @openapi
 * /worker/jobs/stream:
 *   get:
 *     description: Server-Sent Events stream for real-time job notifications
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE stream of job updates
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
app.get('/worker/jobs/stream', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return workerController.streamJobs(req, res, next);
});

/**
 * @openapi
 * /jobs/stats/worker:
 *   get:
 *     description: Get job statistics for the authenticated worker
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Worker job statistics
 */
app.get('/jobs/stats/worker', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return workerController.getStats(req, res, next);
});

app.get('/worker/profile/me', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const profile = await workerProfileService.getFullProfile(req.user.id);
        return res.json(profile);
    } catch (error) {
        return next(error);
    }
});

app.get('/worker/proposals', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const proposals = await workerJobService.getWorkerProposals(req.user.id);
        return res.json({ proposals });
    } catch (error) {
        return next(error);
    }
});

app.get('/worker/bank-account', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const account = await WorkerBankAccount.findOne({ where: { userId: req.user.id } });
        return res.json({ bank_account: account ?? null });
    } catch (error) {
        return next(error);
    }
});

app.post('/worker/bank-account/lookup', [
    passport.authenticate('jwt', { session: false }),
    body('bank_code').exists().trim().notEmpty(),
    body('account_number').exists().trim().isLength({ min: 10, max: 10 }).withMessage('Account number must be 10 digits'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { bank_code, account_number } = req.body;
        const result = await squadService.lookupAccount({ bank_code, account_number });
        return res.json({ account_name: result.data?.account_name ?? null });
    } catch (error: any) {
        return res.status(400).json({ msg: 'Could not verify account. Check details and try again.' });
    }
});

app.post('/worker/bank-account', [
    passport.authenticate('jwt', { session: false }),
    body('account_number').exists().trim().isLength({ min: 10, max: 10 }).withMessage('Account number must be 10 digits'),
    body('bank_code').exists().trim().notEmpty(),
    body('bank_name').exists().trim().notEmpty(),
    body('account_name').exists().trim().notEmpty(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { account_number, bank_code, bank_name, account_name } = req.body;

        const [account] = await WorkerBankAccount.upsert({
            userId: req.user.id,
            accountNumber: account_number,
            bankCode: bank_code,
            bankName: bank_name,
            accountName: account_name,
            verified: true,
        });

        return res.json({ bank_account: account });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /worker/request-advance:
 *   post:
 *     description: Request a partial advance from escrow (e.g. to buy materials)
 *     tags: [Worker]
 *     security:
 *       - bearerAuth: []
 */
app.post('/worker/request-advance', [
    passport.authenticate('jwt', { session: false }),
    body('job_id').exists().isUUID(),
    body('amount').exists().isFloat({ min: 1 }),
    body('reason').optional().trim().isLength({ max: 300 }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { job_id, amount, reason } = req.body;
        const request = await escrowService.requestAdvance(job_id, req.user.id, Number(amount), reason);
        return res.json({ advance_request: request });
    } catch (error: any) {
        if (error.message?.includes('Not assigned') || error.message?.includes('must be in progress') || error.message?.includes('must be funded') || error.message?.includes('exceeds')) {
            return res.status(400).json({ msg: error.message });
        }
        return next(error);
    }
});

app.patch('/worker/profile/photo', [
    passport.authenticate('jwt', { session: false }),
    body('photo_url').notEmpty().isURL().withMessage('Valid photo_url is required'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.mapped() });
        }

        const profile = await workerProfileService.findOrCreate(req.user.id);
        await profile.update({ photoUrl: req.body.photo_url });
        return res.json({ photo_url: profile.photoUrl });
    } catch (error) {
        return next(error);
    }
});
