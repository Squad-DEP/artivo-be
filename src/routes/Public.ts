import { param, validationResult } from 'express-validator';
import express from 'express';
import { WorkerService } from '../services/marketplace/WorkerService';

export const app = express.Router();

const workerService = new WorkerService();

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
        const worker = await workerService.getWorkerBySlug(slug);

        if (!worker) {
            return res.status(404).json({ msg: 'Profile not found' });
        }

        return res.json({ worker });
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
