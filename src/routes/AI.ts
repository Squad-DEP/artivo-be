import { body, validationResult, matchedData } from 'express-validator';
import SpeechService from '../services/speech/SpeechService';
import AIService from '../services/ai/AIService';
import express from 'express';

export const app = express.Router();

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - audioData
 *               - userType
 *             properties:
 *               audioData:
 *                 type: string
 *                 description: Base64 encoded audio data
 *               userType:
 *                 type: string
 *                 enum: [artisan, customer]
 *                 description: Type of user being onboarded
 *     responses:
 *       200:
 *         description: Successfully processed voice data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Processed onboarding data
 *       422:
 *         description: Validation errors
 *       500:
 *         description: AI service error
 */
app.post('/ai/onboard/voice', [
    body('audioData')
        .exists()
        .notEmpty()
        .withMessage('Audio data is required'),
    body('userType')
        .exists()
        .isIn(['artisan', 'customer'])
        .withMessage('User type must be either artisan or customer'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        
        const { audioData, userType } = matchedData(req);

        //sanitize: strip potential front end uri prefixes 
        const cleanBase64Audio = audioData.replace(/^data:audio\/\w+;base64,/, '').trim();

        //direct stream: Pass clean base64 directly into the unified multimodal provider matrix
        const aiResult = await AIService.processOnboarding(cleanBase64Audio, userType);

        if (!aiResult.success) {
            return res.status(500).json({
                message: 'Failed to process audio onboarding with AI',
                error: aiResult.error,
            });
        }

        return res.status(200).json({
            message: true,
            data: aiResult.data,
        });
        
        
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - userType
 *             properties:
 *               text:
 *                 type: string
 *                 description: User's text input
 *               userType:
 *                 type: string
 *                 enum: [artisan, customer]
 *                 description: Type of user being onboarded
 *               context:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Previous conversation context
 *     responses:
 *       200:
 *         description: Successfully processed text input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: AI response and extracted data
 *       422:
 *         description: Validation errors
 *       500:
 *         description: AI service error
 */
app.post('/ai/onboard/text', [
    body('text')
        .exists()
        .notEmpty()
        .withMessage('Text input is required'),
    body('userType')
        .exists()
        .isIn(['artisan', 'customer'])
        .withMessage('User type must be either artisan or customer'),
    body('context')
        .optional()
        .isArray()
        .withMessage('Context must be an array'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        
        const { text, userType, context } = matchedData(req);

        const result = await AIService.processOnboarding(text, userType, context);

        if (!result.success) {
            return res.status(500).json({ 
                msg: 'Failed to process text input',
                error: result.error, 
            });
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's message
 *               context:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Conversation history
 *     responses:
 *       200:
 *         description: Successfully processed message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: AI response
 *       422:
 *         description: Validation errors
 *       500:
 *         description: AI service error
 */
app.post('/ai/chat', [
    body('message')
        .exists()
        .notEmpty()
        .withMessage('Message is required'),
    body('context')
        .optional()
        .isArray()
        .withMessage('Context must be an array'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        
        const { message, context } = matchedData(req);

        const result = await AIService.chat(message, context);

        if (!result.success) {
            return res.status(500).json({ 
                msg: 'Failed to process message',
                error: result.error, 
            });
        }

        return res.json(result);
    } catch (error) {
        return next(error);
    }
});
