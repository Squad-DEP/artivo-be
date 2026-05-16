import { param, body, validationResult, matchedData } from 'express-validator';
import express from 'express';
import { WorkerService } from '../services/marketplace/WorkerService';
import { WorkerProfileService } from '../services/marketplace/WorkerProfileService';
import { Organization } from '../models/Organization';
import { OrgApplication } from '../models/OrgApplication';

export const app = express.Router();

const workerService = new WorkerService();
const workerProfileService = new WorkerProfileService();

/**
 * Public endpoint - Get worker profile by share slug
 * No authentication required - for sharing profiles
 */
app.get('/profile/:slug', [
    param('slug').exists().trim(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { slug } = req.params;
        const profile = await workerProfileService.getBySlug(slug);

        if (!profile) {
            return res.status(404).json({ msg: 'Profile not found' });
        }

        return res.json({ worker: profile });
    } catch (error) {
        return next(error);
    }
});

/**
 * Public endpoint - Get worker reputation/credit score
 * For external companies to check credit scores
 * Requires API key in header: X-API-Key
 */
app.get('/credit-score/:user_id', [
    param('user_id').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        // Verify API key
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || apiKey !== process.env.EXTERNAL_API_KEY) {
            return res.status(401).json({ msg: 'Invalid or missing API key' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { user_id } = req.params;
        const worker = await workerService.getWorkerById(user_id);

        if (!worker) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Return only credit/reputation data
        return res.json({
            user_id: worker.id,
            full_name: worker.full_name,
            credit_score: worker.credit_score,
            completion_rate: worker.completion_rate,
            total_jobs: worker.total_jobs,
            average_rating: worker.average_rating,
            last_updated: new Date().toISOString(),
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /public/organizations:
 *   get:
 *     description: List all active organizations artisans can apply to join
 *     tags: [Public, Organizations]
 */
app.get('/organizations', async (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const orgs = await Organization.findAll({
            where: { isActive: true },
            attributes: ['id', 'name', 'description', 'logoUrl', 'sector', 'website'],
            order: [['name', 'ASC']],
        });
        return res.json({ organizations: orgs });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /public/organizations/{org_id}/apply:
 *   post:
 *     description: Submit an artisan application to join an organization
 *     tags: [Public, Organizations]
 */
app.post('/organizations/:org_id/apply', [
    param('org_id').isUUID(),
    body('phone').notEmpty().trim(),
    body('full_name').optional({ nullable: true }).trim(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { org_id } = req.params;
        const { phone, full_name } = matchedData(req) as { phone: string; full_name?: string };

        const org = await Organization.findByPk(org_id);
        if (!org || !org.isActive) {
            return res.status(404).json({ msg: 'Organization not found' });
        }

        const application = await OrgApplication.create({
            organizationId: org_id,
            phone: phone.replace(/\s+/g, ''),
            fullName: full_name ?? null,
            status: 'pending',
        });

        return res.status(201).json({
            msg: 'Application submitted',
            application_id: application.id,
            organization: org.name,
            status: 'pending',
        });
    } catch (error) {
        return next(error);
    }
});
