import { body, query, param, validationResult, matchedData } from 'express-validator';
import passport from './../providers/Passport';
import express from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { WorkerService } from '../services/marketplace/WorkerService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { JobService } from '../services/marketplace/JobService';
import { PaymentService } from '../services/marketplace/PaymentService';
import { ReviewService } from '../services/marketplace/ReviewService';
import MatchingService from '../services/matching/MatchingService';

export const app = express.Router();

// Initialize services with dependency injection
const workerService = new WorkerService();
const jobRequestService = new JobRequestService();
const jobService = new JobService(jobRequestService);
const paymentService = new PaymentService(jobService);
const reviewService = new ReviewService();
const matchingService = MatchingService;

// Initialize controller
const customerController = new CustomerController(
    workerService,
    jobRequestService,
    jobService,
    paymentService,
    reviewService,
    matchingService
);

/**
 * @swagger
 * tags:
 *   - name: Customer
 *     description: Customer marketplace endpoints
 */

/**
 * @openapi
 * /customer/feed:
 *   get:
 *     description: Get personalized feed of available workers
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: job_type_id
 *         schema:
 *           type: string
 *         description: Filter by job type
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Returns list of workers with AI-powered ranking
 */
app.get('/customer/feed', [
    passport.authenticate('jwt', { session: false }),
    query('job_type_id').optional(),
    query('location').optional(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.getFeed(req, res, next);
});

/**
 * @openapi
 * /customer/request-job:
 *   post:
 *     description: Create a new job request
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
 *               - job_type_id
 *               - title
 *               - description
 *             properties:
 *               job_type_id:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               budget:
 *                 type: number
 *     responses:
 *       200:
 *         description: Job request created successfully
 */
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

/**
 * @openapi
 * /customer/hire:
 *   post:
 *     description: Hire a worker for a job request
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
 *               - job_request_id
 *               - worker_id
 *               - amount
 *             properties:
 *               job_request_id:
 *                 type: string
 *               worker_id:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Worker hired successfully
 */
app.post('/customer/hire', [
    passport.authenticate('jwt', { session: false }),
    body('job_request_id').exists().isUUID(),
    body('worker_id').exists().isUUID(),
    body('amount').exists().isFloat({ min: 0 }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.hire(req, res, next);
});

/**
 * @openapi
 * /customer/payment:
 *   post:
 *     description: Log payment after Squad payment completion
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
 *               - squad_transaction_id
 *               - amount
 *               - status
 *             properties:
 *               job_id:
 *                 type: string
 *               squad_transaction_id:
 *                 type: string
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment logged successfully
 */
app.post('/customer/payment', [
    passport.authenticate('jwt', { session: false }),
    body('job_id').exists().isUUID(),
    body('squad_transaction_id').exists().trim(),
    body('amount').exists().isFloat({ min: 0 }),
    body('status').exists().trim(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.logPayment(req, res, next);
});

/**
 * @openapi
 * /customer/complete-job/{job_id}:
 *   post:
 *     description: Mark job as completed by customer
 *     tags: [Customer]
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
 *         description: Job marked as completed
 */
app.post('/customer/complete-job/:job_id', [
    passport.authenticate('jwt', { session: false }),
    param('job_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
    return customerController.completeJob(req, res, next);
});

/**
 * @openapi
 * /customer/rate:
 *   post:
 *     description: Rate a worker after job completion
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
 *         description: Rating submitted successfully
 */
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

/**
 * @openapi
 * /customer/my-job-requests:
 *   get:
 *     description: Get all job requests created by this customer
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of job requests
 */
app.get('/customer/my-job-requests', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return customerController.getMyJobRequests(req, res, next);
});

/**
 * @openapi
 * /customer/my-jobs:
 *   get:
 *     description: Get all jobs for this customer
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of customer's jobs
 */
app.get('/customer/my-jobs', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return customerController.getMyJobs(req, res, next);
});
