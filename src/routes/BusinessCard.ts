import { body, validationResult, matchedData } from 'express-validator';
import { ArtisanDataDTO, identityCardService } from 'services/business_card/businessCardService';
import express from 'express';
import passport from '../providers/Passport';

export const app = express.Router();

/**
 * @openapi
 * /artisan/identity-card:
 *   post:
 *     description: Generate a high-resolution identity card for an artisan
 *     tags: [Artisan]
 *     security:
 *       - bearerAuth: []
 */
app.post('/artisan/identity-card', [
    passport.authenticate('jwt', { session: false }),
    body('username').exists().trim().notEmpty(),
    body('artisan_name').exists().trim().notEmpty(),
    body('trade').exists().trim().notEmpty(),
    body('location').exists().trim().notEmpty(),
    body('contact').exists().trim().notEmpty(),
    body('headshot_url').optional().isURL().withMessage('Headshot must be a valid URL'),
    body('tagline').optional().trim(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const artisanData = matchedData(req) as ArtisanDataDTO;

        // Generate the card buffer using your service
        const imageBuffer = await identityCardService.createIdentityCard(artisanData);

        // Set headers so the browser/frontend knows it's an image
        res.set({
            'Content-Type': 'image/png',
            'Content-Length': imageBuffer.length,
            'Content-Disposition': `inline; filename="id_card_${artisanData.username}.png"`
        });

        return res.send(imageBuffer);

    } catch (error) {
        console.error('Error generating identity card:', error);
        return next(error);
    }
});
