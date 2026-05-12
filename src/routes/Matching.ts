import { param, validationResult, matchedData } from 'express-validator';
import MatchingService from '../services/matching/MatchingService';
import passport from '../providers/Passport';
import express from 'express';
import { sequelize } from '../providers/db';
import { QueryTypes } from 'sequelize';

export const app = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Matching
 *     description: AI-powered job matching
 */

/**
 * @openapi
 * /matching/job-types:
 *   get:
 *     description: Get all available job types
 *     tags: [Matching]
 *     responses:
 *       200:
 *         description: List of job types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 */
app.get('/matching/job-types', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const jobTypes = await sequelize.query(
            'SELECT id, name, description FROM job_types ORDER BY name',
            { type: QueryTypes.SELECT }
        );
        return res.json(jobTypes);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /jobs/{jobId}/matches:
 *   get:
 *     description: Get AI-ranked worker matches for a job
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job request ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 5
 *         description: Number of matches to return
 *     responses:
 *       200:
 *         description: Ranked list of matching workers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       worker_id:
 *                         type: string
 *                       worker_name:
 *                         type: string
 *                       match_score:
 *                         type: number
 *                       explanation:
 *                         type: string
 *                       score_breakdown:
 *                         type: object
 */
app.get('/jobs/:jobId/matches', [
    passport.authenticate('jwt', { session: false }),
    param('jobId').exists().isUUID(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        
        const { jobId } = matchedData(req);
        const limit = parseInt(req.query.limit as string) || 5;

        // TODO: Fetch job from database
        // TODO: Fetch workers from database
        // For now, return mock data structure
        
        const mockJob = {
            id: jobId,
            title: 'Need a plumber for bathroom repair',
            description: 'Looking for experienced plumber to fix leaking pipes',
            location: 'Lagos',
            budget: 50000,
            job_type: 'Plumbing'
        };

        const mockWorkers = [
            {
                user_id: '123',
                display_name: 'John Doe',
                bio: 'Experienced plumber with 5 years',
                skills: ['plumbing', 'pipe fitting'],
                location: 'Lagos',
                reputation_score: {
                    credit_score: 85,
                    completion_rate: 95,
                    average_rating: 4.5,
                    total_jobs: 20
                }
            }
        ];

        const matches = await MatchingService.getTopMatches(mockJob, mockWorkers, limit);

        return res.json({ matches });
    } catch (error) {
        return next(error);
    }
});
