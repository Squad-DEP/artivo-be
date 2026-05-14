import passport from './../providers/Passport';
import express from 'express';
import { CreditService } from '../services/marketplace/CreditService';

export const app = express.Router();

const creditService = new CreditService();

/**
 * @openapi
 * /credit:
 *   get:
 *     description: Get the authenticated worker's credit profile
 *     tags: [Credit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Worker credit profile
 */
app.get('/credit', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const result = await creditService.getCreditProfile(req.user.id);
        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /credit/consent:
 *   put:
 *     description: Update credit data sharing consent (stub)
 *     tags: [Credit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consent_enabled
 *             properties:
 *               consent_enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Consent updated
 */
app.put('/credit/consent', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        await creditService.updateConsent(req.user.id, req.body.consent_enabled);
        return res.json({ consent_enabled: req.body.consent_enabled });
    } catch (error) {
        return next(error);
    }
});
