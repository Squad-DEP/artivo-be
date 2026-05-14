import { body, param, validationResult } from 'express-validator';
import passport from './../providers/Passport';
import express from 'express';
import { WorkerProfile } from '../models/WorkerProfile';
import { User } from '../models/User';
import { WorkerController } from '../controllers/WorkerController';
import { WorkerJobService } from '../services/marketplace/WorkerJobService';
import { JobService } from '../services/marketplace/JobService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { EscrowService } from '../services/marketplace/EscrowService';
import { ReviewService } from '../services/marketplace/ReviewService';

export const app = express.Router();

// Initialize services with dependency injection
const workerJobService = new WorkerJobService();
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
    try {
        const stats = await workerJobService.getWorkerStats(req.user.id);
        return res.json(stats);
    } catch (error) {
        return next(error);
    }
});

async function findOrCreateWorkerProfile(userId: string) {
    const user = await User.unscoped().findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const shareSlug = user.fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + userId.slice(0, 6);

    const [profile] = await WorkerProfile.findOrCreate({
        where: { userId },
        defaults: { userId, displayName: user.fullName, shareSlug, photoUrl: null },
    });

    return profile;
}

app.get('/worker/profile/me', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const profile = await findOrCreateWorkerProfile(req.user.id);
        return res.json({
            display_name: profile.displayName,
            photo_url: profile.photoUrl,
            bio: profile.bio,
            skills: profile.skills,
            location: profile.location,
            share_slug: profile.shareSlug,
        });
    } catch (error) {
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

        const profile = await findOrCreateWorkerProfile(req.user.id);
        await profile.update({ photoUrl: req.body.photo_url });
        return res.json({ photo_url: profile.photoUrl });
    } catch (error) {
        return next(error);
    }
});
