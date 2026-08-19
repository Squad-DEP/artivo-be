import { body, validationResult, matchedData, param } from 'express-validator';
import { ucFirst, generateJWT, generateEmail } from './../providers/Helpers';
import { User, UserModel } from './../models/User';
import passport from './../providers/Passport';
import middleware from './middleware';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import express from 'express';
import crypto from 'crypto';
import { VirtualAccountService } from '../services/squad/VirtualAccountService';

export const app = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication routes
 * 
 * components:
 *   schemas:
 *     AccessToken:
 *       properties:
 *         accessToken:
 *           type: string
 */


/**
 * @swagger
 * /auth/login:
 *   post:
 *     description: Get an access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 example: "Password@1234"
 *                 description: User's password
 *               token:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "000000"
 *                 description: Optional MFA code if enabled for account
 *     responses:
 *       200:
 *         description: Successfully logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccessToken'
 *       401:
 *         description: Invalid credentials or MFA code
 *       403:
 *         description: MFA code required but not provided
 *       422:
 *         description: Validation errors
 */
app.post('/auth/login', [
    body('email').exists().toLowerCase(),
    body('password').exists(),

    middleware.hCaptcha,

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
            const { email } = matchedData(req);
            const user = await User.findOne({ where: { email } });
            if (!user) return res.status(401).json({ msg: 'Incorrect email or password' });
            return next();
        } catch (error) {
            return res.status(401).json({ msg: 'Incorrect email or password' });
        }
    },
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const { email } = matchedData(req);

        passport.authenticate('local', { session: false }, async (err: Error | null, user: UserModel | null) => {
            if (err) throw err;
            if (!user) return res.status(401).json({ msg: 'Incorrect email or password' });

            req.login(user, { session: false }, (err_: Error) => {
                if (err_) throw err_;

                res.json({
                    accessToken: generateJWT(user, { expiresIn: '24h' }),
                });
            });
        })(req, res, next);
    } catch (error) {
        return next(error);
    }
});

/**
 * @swagger
 * /auth/login/mfa:
 *   post:
 *     description: Check if MFA is enabled for a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *     responses:
 *       200:
 *         description: Successfully checked MFA status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mfa:
 *                   type: boolean
 */
app.post('/auth/login/mfa', [
    body('email').optional().default('').toLowerCase(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        // MFA not implemented in simplified schema
        return res.json({ mfa: false });
    } catch (error) {
        return res.json({ mfa: false });
    }
});

/**
 * @openapi
 * /auth/sign-up:
 *   post:
 *     description: Register a new user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - tos
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 description: User's password (must meet strength requirements)
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name (optional)
 *               tos:
 *                 type: boolean
 *                 description: Acceptance of Terms of Service
 *     responses:
 *       200:
 *         description: Successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccessToken'
 *       422:
 *         description: Validation errors (email taken, weak password, etc.)
 */
app.post('/auth/sign-up', [
    body('email')
        .isEmail()
        .trim()
        .toLowerCase()
        .custom(async (email) => {
            const user = await User.findOne({ where: { email } });
            if (user) throw new Error('This email address is taken');
        }),
    body('password')
        .notEmpty()
        .exists(),
    body('firstName')
        .notEmpty()
        .exists(),
    body('lastName')
        .optional()
        .default(''),
    body('phone')
        .optional(),
    body('dob')
        .optional()
        .isDate({ format: 'YYYY-MM-DD' })
        .withMessage('dob must be a valid date in YYYY-MM-DD format'),
    body('role')
        .exists()
        .isIn(['worker', 'customer']),
    body('tos', 'You must accept the Terms of Service to use this platform')
        .optional()
        .default(true),
    middleware.isStrongPassword,
    middleware.hCaptcha,
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const data = matchedData(req);

        const userID = uuidv4();
        const fullName = data.lastName 
            ? `${ucFirst(data.firstName)} ${ucFirst(data.lastName)}`.trim()
            : ucFirst(data.firstName);

        const user = await User.create({
            id: userID,
            email: data.email,
            phone: data.phone || null,
            dob: data.dob || null,
            fullName,
            role: data.role,
            password: bcrypt.hashSync(data.password, bcrypt.genSaltSync(10)),
            emailVerificationKey: String(Math.floor(Math.random() * (999999 - 111111 + 1)) + 111111),
        });

        //////////////////////////////////////////
        // EMAIL THIS TO THE USER
        if (typeof global.it !== 'function') console.log(`\n\nEMAIL THIS CODE TO THE USER\nCODE: ${user.emailVerificationKey}\n\n`);
        //////////////////////////////////////////

        return passport.authenticate('local', { session: false }, (err: Error, usr: UserModel) => {
            if (err) throw err;

            req.login(usr, { session: false }, (err_) => {
                if (err_) throw err_;

                res.json({
                    accessToken: generateJWT(usr, {
                        expiresIn: '24h',
                    }),
                });
            });
        })(req, res);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /auth/verify-email/{emailVerificationKey}:
 *   get:
 *     description: Verify a user's email address using the verification key
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: emailVerificationKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification key sent to the user's email
 *       - in: query
 *         name: redirect
 *         schema:
 *           type: string
 *           enum: ['1']
 *         description: If set to '1', redirects to frontend after verification
 *     responses:
 *       200:
 *         description: Email successfully verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                 id:
 *                   type: string
 */
app.get('/auth/verify-email/:emailVerificationKey', [
    param('emailVerificationKey').exists(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const { emailVerificationKey } = matchedData(req);

        const user = await User.findOne({
            where: {
                emailVerificationKey,
            },
            rejectOnEmpty: true,
        });

        await user.update({
            emailVerified: true,
            emailVerificationKey: null,
        });

        // Create virtual account after email verification
        const virtualAccountService = new VirtualAccountService();
        await virtualAccountService.createVirtualAccountForUser(user);

        if (req.query.redirect === '1') return res.redirect(`${process.env.FRONTEND_URL}?email_verified=1`);

        return res.json({ verified: true, id: user.id });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /auth/forgot:
 *   post:
 *     description: Request a password reset link
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
app.post('/auth/forgot', [
    body('email')
        .isEmail()
        .toLowerCase()
        .custom(async (email) => {
            const user = await User.findOne({ where: { email } });
            if (!user) throw new Error('This email address does not exist');
        }),
    middleware.hCaptcha,
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const { email } = matchedData(req);

        const user = await User.findOne({
            where: { email },
            rejectOnEmpty: true,
        });

        const passwordResetKey = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');

        await user.update({ passwordResetKey });

        //////////////////////////////////////////
        // EMAIL THIS TO THE USER
        const link = `${process.env.FRONTEND_URL}/reset/${passwordResetKey}`;
        if (typeof global.it !== 'function') console.log(`\n\nEMAIL THIS TO THE USER\nPASSWORD RESET LINK: ${link}\n\n`);
        // const html = generateEmail('Reset', { firstName: user.firstName, link });
        //////////////////////////////////////////

        return res.json({ success: true });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /auth/get-user-by-reset-key/{passwordResetKey}:
 *   get:
 *     description: Get user information by password reset key
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: passwordResetKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset key sent to the user's email
 *     responses:
 *       200:
 *         description: Returns user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 */
app.get('/auth/get-user-by-reset-key/:passwordResetKey', [
    param('passwordResetKey').exists(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const { passwordResetKey } = matchedData(req);

        const user = await User.findOne({
            where: {
                passwordResetKey,
            },
            attributes: ['id', 'email'],
            rejectOnEmpty: true,
        });

        return res.json({
            id: user.id,
            email: user.email,
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /auth/reset:
 *   post:
 *     description: Reset user password using reset key
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - passwordResetKey
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 description: New password (must meet strength requirements)
 *               passwordResetKey:
 *                 type: string
 *                 description: Password reset key sent to the user's email
 *     responses:
 *       200:
 *         description: Password successfully reset and user logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccessToken'
 */
app.post('/auth/reset', [
    body('email')
        .isEmail()
        .toLowerCase()
        .custom(async (email) => {
            const user = await User.findOne({ where: { email } });
            if (!user) throw new Error('This email address does not exist');
        }),
    body('password')
        .notEmpty()
        .exists(),
    body('passwordResetKey', 'This link has expired')
        .custom(async (passwordResetKey) => {
            if (!passwordResetKey) throw new Error('This link has expired');
            const user = await User.findOne({ where: { passwordResetKey } });
            if (!user) throw new Error('This link has expired');
        }),
    middleware.isStrongPassword,
    middleware.hCaptcha,
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const { email, password, passwordResetKey } = matchedData(req);

        const user = await User.findOne({
            where: { email, passwordResetKey },
            rejectOnEmpty: true,
        });

        await user.update({
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
            passwordResetKey: null,
        });

        return passport.authenticate('local', { session: false }, (err: Error | null, usr: UserModel | null) => {
            if (err) throw err;
            if (!usr) throw new Error('User not found');

            req.login(usr, { session: false }, (err_) => {
                if (err_) throw err_;

                return res.json({
                    accessToken: generateJWT(usr, {
                        expiresIn: '24h',
                    }),
                });
            });
        })(req, res);
    } catch (error) {
        return next(error);
    }
});

/**
 * @swagger
 * /_authcheck:
 *   get:
 *     description: Check if access token is valid
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Access token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auth:
 *                   type: boolean
 *                 id:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
app.get('/_authcheck', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response) => res.json({
    auth: true,
    id: req.user.id,
}));

/**
 * @openapi
 * /auth/verify-email-manual:
 *   post:
 *     description: Manually verify email (for demo/testing)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email verified and virtual account created
 */
/**
 * @openapi
 * /auth/guest-signup:
 *   post:
 *     description: Create a guest account with auto-generated credentials. No captcha required.
 *     tags: [Auth]
 */
app.post('/auth/guest-signup', [
    body('role').exists().isIn(['worker', 'customer']).withMessage('Role must be worker or customer'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

        const { role } = matchedData(req);

        // Generate readable guest credentials
        const WORDS = ['swift', 'bright', 'bold', 'keen', 'quick', 'calm', 'clear', 'sharp', 'smart', 'fresh'];
        const word = WORDS[Math.floor(Math.random() * WORDS.length)];
        const num = Math.floor(1000 + Math.random() * 9000); // 4-digit
        const guestEmail = `${word}${num}@artivo.app`;
        const guestPassword = `Artivo#${crypto.randomBytes(3).toString('hex')}`;

        const user = await User.create({
            id: uuidv4(),
            email: guestEmail,
            fullName: 'Guest',
            role,
            password: bcrypt.hashSync(guestPassword, bcrypt.genSaltSync(10)),
            emailVerified: true,
            emailVerificationKey: null,
        });

        const token = generateJWT(user, { expiresIn: '7d' });

        return res.json({
            accessToken: token,
            guest_email: guestEmail,
            guest_password: guestPassword,
            is_guest: true,
        });
    } catch (error) {
        return next(error);
    }
});

app.post('/auth/verify-email-manual', [
    body('email').isEmail().toLowerCase(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const { email } = matchedData(req);

        const user = await User.findOne({
            where: { email },
            rejectOnEmpty: true,
        });

        if (user.emailVerified) {
            return res.json({ msg: 'Email already verified', verified: true });
        }

        await user.update({
            emailVerified: true,
            emailVerificationKey: null,
        });

        // Create virtual account after email verification
        const virtualAccountService = new VirtualAccountService();
        const virtualAccount = await virtualAccountService.createVirtualAccountForUser(user);

        return res.json({ 
            verified: true, 
            id: user.id,
            virtual_account: virtualAccount ? {
                account_number: virtualAccount.virtualAccountNumber,
                account_name: virtualAccount.virtualAccountName,
                bank_name: virtualAccount.bankName,
            } : null,
        });
    } catch (error) {
        return next(error);
    }
});
