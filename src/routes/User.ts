import { body, validationResult, matchedData } from 'express-validator';
import passport from './../providers/Passport';
import middleware from './middleware';
import User from './../models/User';
import bcrypt from 'bcryptjs';
import express from 'express';

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
        return res.json(await User.findByPk(req.user.id, {
            rejectOnEmpty: true,
        }));
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
        const user = await User.findByPk(req.user.id, { rejectOnEmpty: true });
        await user.update(data);
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
        const user = await User.findByPk(req.user.id, { rejectOnEmpty: true });
        await user.update({
            emailVerificationKey: String(Math.floor(Math.random() * (999999 - 111111 + 1)) + 111111),
        });

        //////////////////////////////////////////
        // EMAIL THIS LINK TO THE USER
        if (typeof global.it !== 'function') console.log(`\n\nEMAIL THIS CODE TO THE USER\nCODE: ${user.emailVerificationKey}\n\n`);
        //////////////////////////////////////////

        return res.json({ email: user.email });
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

    body('newPassword')
        .notEmpty()
        .exists(),
    body('password')
        .notEmpty()
        .exists(),

    middleware.checkPassword,
    middleware.isStrongPassword,
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const data = matchedData(req);

        await User.unscoped().update({
            password: bcrypt.hashSync(data.newPassword, bcrypt.genSaltSync(10)),
        }, {
            where: {
                id: req.user.id,
            },
        });

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
        const { VirtualAccountService } = await import('../services/squad/VirtualAccountService');
        const virtualAccountService = new VirtualAccountService();
        
        const virtualAccount = await virtualAccountService.getVirtualAccountByUserId(req.user.id);

        if (!virtualAccount) {
            return res.status(404).json({ msg: 'Virtual account not found' });
        }

        return res.json({ virtual_account: virtualAccount });
    } catch (error) {
        return next(error);
    }
});
