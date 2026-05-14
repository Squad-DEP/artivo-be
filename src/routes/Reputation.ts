import passport from './../providers/Passport';
import express from 'express';
import { ReputationService } from '../services/marketplace/ReputationService';

export const app = express.Router();

const reputationService = new ReputationService();

/**
 * @openapi
 * /reputation:
 *   get:
 *     description: Get the authenticated worker's reputation score and review summary
 *     tags: [Reputation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Worker reputation data
 */
app.get('/reputation', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const result = await reputationService.getReputation(req.user.id);
        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /reputation/reviews:
 *   get:
 *     description: Get paginated reviews for the authenticated user
 *     tags: [Reputation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated review summary
 */
app.get('/reputation/reviews', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
        const result = await reputationService.getReviews(req.user.id, page);
        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /reputation/reviews/{id}/respond:
 *   post:
 *     description: Respond to a review (stub)
 *     tags: [Reputation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response recorded
 */
app.post('/reputation/reviews/:id/respond', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        await reputationService.respondToReview(req.params.id, req.body.response);
        return res.json({ msg: 'Response recorded' });
    } catch (error) {
        return next(error);
    }
});
