import { body, validationResult, matchedData } from 'express-validator';
import AIService from '../services/ai/AIService';
import { OnboardingService } from '../services/onboarding/OnboardingService';
import express from 'express';
import passport from '../providers/Passport';

export const app = express.Router();

const onboardingService = new OnboardingService();

/**
 * @swagger
 * tags:
 *   - name: AI
 *     description: AI-powered onboarding and assistance
 */

/**
 * @openapi
 * /ai/onboard/voice:
 *   post:
 *     description: Process voice data for AI-powered onboarding
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
app.post('/ai/onboard/voice', [
    passport.authenticate('jwt', { session: false }),
    body('userType').exists().isIn(['artisan', 'customer']).withMessage('User type must be artisan or customer'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const audioFile = req.files?.audio as any;
        if (!audioFile) return res.status(422).json({ errors: { audio: { msg: 'Audio file is required' } } });

        const { userType } = matchedData(req);
        const base64Audio = audioFile.data.toString('base64');
        const mimeType = (audioFile.mimetype || 'audio/webm').split(';')[0].trim();
        console.log(`Voice onboard: file=${audioFile.name}, mime=${mimeType}, size=${audioFile.size}B, user=${userType}`);
        const result = await AIService.processOnboarding(base64Audio, userType, [], mimeType);

        if (!result.success) {
            return res.status(500).json({ msg: 'Failed to process audio onboarding', error: result.error });
        }

        return res.json({ message: true, data: result.data });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /ai/onboard/text:
 *   post:
 *     description: Process text input for AI-powered onboarding
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
app.post('/ai/onboard/text', [
    passport.authenticate('jwt', { session: false }),
    body('text').exists().notEmpty().withMessage('Text input is required'),
    body('userType').exists().isIn(['artisan', 'customer']).withMessage('User type must be artisan or customer'),
    body('context').optional().isArray().withMessage('Context must be an array'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { text, userType, context } = matchedData(req);
        const result = await AIService.processOnboarding(text, userType, context);

        if (!result.success) {
            return res.status(500).json({ msg: 'Failed to process text input', error: result.error });
        }

        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /ai/chat:
 *   post:
 *     description: General AI chat for assistance
 *     tags: [AI]
 */
app.post('/ai/chat', [
    body('message').exists().notEmpty().withMessage('Message is required'),
    body('context').optional().isArray().withMessage('Context must be an array'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { message, context } = matchedData(req);
        const result = await AIService.chat(message, context);

        if (!result.success) {
            return res.status(500).json({ msg: 'Failed to process message', error: result.error });
        }

        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /ai/extract-job/voice:
 *   post:
 *     description: Extract job details from voice input
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
app.post('/ai/extract-job/voice', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const audioFile = req.files?.audio as any;
        if (!audioFile) return res.status(422).json({ errors: { audio: { msg: 'Audio file is required' } } });

        const jobTypes = await onboardingService.getJobTypes();
        const base64Audio = audioFile.data.toString('base64');
        const mimeType = (audioFile.mimetype || 'audio/webm').split(';')[0].trim();
        console.log(`Voice job extract: file=${audioFile.name}, mime=${mimeType}, size=${audioFile.size}B`);
        const result = await AIService.extractJobDescription(base64Audio, jobTypes, mimeType);

        if (!result.success) {
            return res.status(500).json({ msg: 'Failed to extract job details from audio', error: result.error });
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /ai/extract-job/text:
 *   post:
 *     description: Extract job details from text input
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
app.post('/ai/extract-job/text', [
    passport.authenticate('jwt', { session: false }),
    body('text').exists().notEmpty().withMessage('Text input is required'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { text } = matchedData(req);
        
        // Get available job types
        const jobTypes = await onboardingService.getJobTypes();
        
        const result = await AIService.extractJobDescription(text, jobTypes);

        if (!result.success) {
            return res.status(500).json({ msg: 'Failed to extract job details from text', error: result.error });
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /ai/onboard/save:
 *   post:
 *     description: >
 *       Save AI-extracted onboarding data for the authenticated user.
 *       Updates user record and (for workers) upserts the worker profile.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
app.post('/ai/onboard/save', [
    passport.authenticate('jwt', { session: false }),
    body('fullName').optional().trim(),
    body('phone').optional().trim(),
    body('skills').optional().trim(),
    body('bio').optional().trim(),
    body('tagline').optional().trim().isLength({ max: 100 }),
    body('location').optional().trim(),
    body('experience').optional().trim(),
    body('avgPay').optional().trim(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        await onboardingService.saveProfile(req.user.id, matchedData(req));

        return res.json({ msg: 'Profile saved successfully', userId: req.user.id });
    } catch (error) {
        return next(error);
    }
});
