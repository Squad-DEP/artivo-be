import { body, param, validationResult, matchedData } from 'express-validator';
import passport from './../providers/Passport';
import middleware from './middleware';
import express from 'express';
import { JobService } from '../services/marketplace/JobService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { 
    UserService, 
    PasswordService, 
    EmailVerificationService, 
    UserJobQueryService 
} from '../services/user';
import { VirtualAccountService } from '../services/squad/VirtualAccountService';

const jobRequestService = new JobRequestService();
const jobService = new JobService(jobRequestService);
const userService = new UserService();
const passwordService = new PasswordService();
const emailVerificationService = new EmailVerificationService();
const userJobQueryService = new UserJobQueryService();
const virtualAccountService = new VirtualAccountService();

export const app = express.Router();

/**
 * @swagger
 * tags:
 *   - name: User
 *     description: User
 */

/**
 * @openapi
 * /user:
 *   get:
 *     description: Get the current user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns the current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 */
app.get('/user', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const user = await userService.getUserById(req.user.id);
        return res.json(user);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /user:
 *   post:
 *     description: Update the current user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: Returns the current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 */
app.post('/user', [
    passport.authenticate('jwt', { session: false }),
    body('fullName').optional(),
    body('phone').optional(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        
        const data = matchedData(req);
        const user = await userService.updateUser(req.user.id, data);
        return res.json(user);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /user/resend-verification-email:
 *   get:
 *     description: Resend the verification email
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 */
app.post('/user/resend-verification-email', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const result = await emailVerificationService.resendVerificationEmail(req.user.id);
        return res.json({ email: result.email });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /user/update-password:
 *   post:
 *     description: Update the current user's password
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
app.post('/user/update-password', [
    passport.authenticate('jwt', { session: false }),
    body('newPassword').notEmpty().exists(),
    body('password').notEmpty().exists(),
    middleware.checkPassword,
    middleware.isStrongPassword,
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        
        const data = matchedData(req);
        await passwordService.updatePassword(req.user.id, data.newPassword);
        return res.json({ success: true });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /user/virtual-account:
 *   get:
 *     description: Get user's virtual account details
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns virtual account details
 */
app.get('/user/virtual-account', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const virtualAccount = await virtualAccountService.getVirtualAccountByUserId(req.user.id);

        if (!virtualAccount) {
            return res.status(404).json({ msg: 'Virtual account not found' });
        }

        return res.json({ virtual_account: virtualAccount });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /jobs:
 *   get:
 *     description: Get all jobs for the authenticated user (as worker or customer)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of jobs
 */
app.get('/jobs', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const jobs = await jobService.getJobsForUser(req.user.id);
        return res.json({ jobs });
    } catch (error) {
        return next(error);
    }
});

app.get('/jobs/:id', [
    passport.authenticate('jwt', { session: false }),
    param('id').isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const job = await userJobQueryService.getJobById(req.params.id, req.user.id);

        if (!job) {
            return res.status(404).json({ msg: 'Job not found' });
        }

        return res.json(job);
    } catch (error) {
        return next(error);
    }
});

app.get('/jobs/:id/applications', [
    passport.authenticate('jwt', { session: false }),
    param('id').isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const applications = await userJobQueryService.getJobApplications(req.params.id, req.user.id);
        return res.json(applications);
    } catch (error) {
        return next(error);
    }
});
