import { body, validationResult, matchedData } from 'express-validator';
import passport from './../providers/Passport';
import express from 'express';
import { VirtualAccountService } from '../services/squad/VirtualAccountService';
import { SquadService } from '../services/squad/SquadService';
import { WithdrawalService } from '../services/marketplace/WithdrawalService';
import { EscrowService } from '../services/marketplace/EscrowService';
import { SquadAccountLimitError } from '../services/squad/SquadErrors';
import { VirtualAccount } from '../models/VirtualAccount';
import { User } from '../models/User';

export const app = express.Router();

const virtualAccountService = new VirtualAccountService();
const squadService = new SquadService();
const withdrawalService = new WithdrawalService(squadService);
const escrowService = new EscrowService();

/**
 * @openapi
 * /account/virtual-account:
 *   get:
 *     description: >
 *       Get the authenticated user's virtual account details.
 *       Returns the account number and bank info so the user knows where
 *       to deposit funds.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Virtual account info
 *       404:
 *         description: Virtual account not yet created
 */
app.get('/account/virtual-account', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const account = await virtualAccountService.getVirtualAccountByUserId(req.user.id);
        if (!account) {
            return res.status(404).json({
                msg: 'Virtual account not found. Please verify your email or contact support.',
            });
        }

        return res.json({
            virtual_account: {
                account_number: account.virtualAccountNumber,
                account_name: account.virtualAccountName,
                bank_name: account.bankName,
                bank_code: account.bankCode,
                customer_identifier: account.customerIdentifier,
                balance: Number(account.balance ?? 0),
                total_deposited: Number(account.totalDeposited ?? 0),
            },
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /account/ensure-setup:
 *   post:
 *     description: >
 *       Auto-verify email and create a virtual account for demo/testing purposes.
 *       If email is not verified, it will be verified automatically.
 *       If no virtual account exists, one will be created.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Virtual account details
 *       503:
 *         description: Could not create virtual account
 */
app.post('/account/ensure-setup', [
    passport.authenticate('jwt', { session: false }),
    body('first_name').notEmpty().trim().withMessage('First name is required'),
    body('last_name').notEmpty().trim().withMessage('Last name is required'),
    body('phone').notEmpty().trim().withMessage('Phone number is required'),
    body('bvn').notEmpty().isLength({ min: 11, max: 11 }).withMessage('BVN must be 11 digits'),
    body('dob').notEmpty().isDate({ format: 'YYYY-MM-DD' }).withMessage('DOB must be YYYY-MM-DD'),
    body('gender').isIn(['1', '2']).withMessage('Gender must be 1 (Male) or 2 (Female)'),
    body('address').notEmpty().isLength({ min: 5 }).withMessage('Address is required'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.mapped() });
        }

        const { first_name, last_name, phone, bvn, dob, gender, address } = matchedData(req) as {
            first_name: string; last_name: string; phone: string;
            bvn: string; dob: string; gender: '1' | '2'; address: string;
        };

        let account;
        try {
            account = await virtualAccountService.ensureSetupForUser(req.user.id, { first_name, last_name, phone, bvn, dob, gender, address });
        } catch (err) {
            if (err instanceof SquadAccountLimitError) {
                // Squad sandbox limit hit — fall back to mock account generation
                const user = await User.findByPk(req.user.id);
                if (user) {
                    account = await virtualAccountService.createMockVirtualAccount(user, { first_name, last_name });
                }
            } else {
                throw err;
            }
        }

        if (!account) {
            return res.status(503).json({ msg: 'Could not create virtual account. Squad may not be configured.' });
        }

        return res.json({
            virtual_account: {
                account_number: account.virtualAccountNumber,
                account_name: account.virtualAccountName,
                bank_name: account.bankName,
                bank_code: account.bankCode,
                customer_identifier: account.customerIdentifier,
                balance: Number(account.balance ?? 0),
                total_deposited: Number(account.totalDeposited ?? 0),
            },
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /account/transactions:
 *   get:
 *     description: Fetch the authenticated user's transaction history from Squad.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 *       404:
 *         description: Virtual account not found
 */
app.get('/account/transactions', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const account = await virtualAccountService.getVirtualAccountByUserId(req.user.id);
        if (!account) {
            return res.status(404).json({ msg: 'Virtual account not found.' });
        }

        const result = await squadService.getCustomerTransactions(account.customerIdentifier);
        return res.json({ transactions: result.data ?? [] });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /account/lookup-bank-account:
 *   post:
 *     description: >
 *       Verify a recipient bank account name before initiating a withdrawal.
 *       Returns the verified account_name to pass to /account/withdraw.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bank_code
 *               - account_number
 *             properties:
 *               bank_code:
 *                 type: string
 *               account_number:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verified account details
 */
app.post('/account/lookup-bank-account', [
    passport.authenticate('jwt', { session: false }),
    body('bank_code').exists().trim().notEmpty(),
    body('account_number').exists().trim().notEmpty(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

    try {
        const result = await squadService.lookupAccount({
            bank_code: req.body.bank_code,
            account_number: req.body.account_number,
        });

        if (!result.success || !result.data) {
            return res.status(400).json({ msg: 'Could not verify bank account. Check the details and try again.' });
        }

        return res.json({
            account_name: result.data.account_name,
            account_number: result.data.account_number,
            bank_code: result.data.bank_code,
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /account/withdraw:
 *   post:
 *     description: >
 *       Withdraw funds from the user's virtual account to their bank account.
 *       You must first call /account/lookup-bank-account to get the verified account_name,
 *       then pass it here. Amount is in NGN (naira).
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - bank_code
 *               - account_number
 *               - account_name
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount in NGN (naira)
 *               bank_code:
 *                 type: string
 *               account_number:
 *                 type: string
 *               account_name:
 *                 type: string
 *                 description: Verified name from /account/lookup-bank-account
 *               remark:
 *                 type: string
 *     responses:
 *       200:
 *         description: Withdrawal initiated
 *       400:
 *         description: Squad rejected the transfer
 *       404:
 *         description: Virtual account not found
 */
app.post('/account/withdraw', [
    passport.authenticate('jwt', { session: false }),
    body('amount').exists().isFloat({ min: 1 }),
    body('bank_code').exists().trim().notEmpty(),
    body('account_number').exists().trim().notEmpty(),
    body('account_name').exists().trim().notEmpty(),
    body('remark').optional().trim(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

    try {
        const { amount, bank_code, account_number, account_name, remark } = req.body;

        const account = await virtualAccountService.getVirtualAccountByUserId(req.user.id);
        if (!account) {
            return res.status(404).json({ msg: 'Virtual account not found. Cannot process withdrawal.' });
        }

        let result;
        try {
            result = await withdrawalService.initiateWithdrawal(req.user.id, {
                amount,
                bank_code,
                account_number,
                account_name,
                remark,
            });
        } catch (serviceErr: any) {
            if (serviceErr.squadError) {
                return res.status(400).json({ msg: 'Withdrawal failed.', details: serviceErr.details });
            }
            throw serviceErr;
        }

        if (result.status === 'pending') {
            return res.status(202).json({
                msg: 'Transfer is pending. Please check status via /account/withdraw/requery.',
                withdrawal_id: result.withdrawal_id,
                transaction_reference: result.transaction_reference,
            });
        }

        return res.json({
            msg: 'Withdrawal initiated successfully',
            withdrawal: {
                id: result.withdrawal_id,
                transaction_reference: result.transaction_reference,
                amount: result.amount,
                bank_code: result.bank_code,
                account_number: result.account_number,
                account_name: result.account_name,
                status: result.withdrawal_status,
            },
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /account/withdraw/requery:
 *   post:
 *     description: >
 *       Re-check the outcome of a withdrawal that timed out (424).
 *       Pass the transaction_reference from the original /account/withdraw call.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transaction_reference
 *             properties:
 *               transaction_reference:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transfer status
 */
app.post('/account/withdraw/requery', [
    passport.authenticate('jwt', { session: false }),
    body('transaction_reference').exists().trim().notEmpty(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

    try {
        const { transaction_reference } = req.body;

        let result;
        try {
            result = await withdrawalService.requeryWithdrawal(req.user.id, transaction_reference);
        } catch (serviceErr: any) {
            if (serviceErr.notFound) {
                return res.status(404).json({ msg: 'Withdrawal not found.' });
            }
            throw serviceErr;
        }

        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /account/withdrawals:
 *   get:
 *     description: Get the authenticated user's withdrawal history.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of withdrawals
 */
app.get('/account/withdrawals', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const withdrawals = await withdrawalService.getWithdrawalHistory(req.user.id);
        return res.json({ withdrawals });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /account/simulate-deposit:
 *   post:
 *     description: >
 *       DEMO ONLY — Simulate a bank deposit by directly crediting the virtual account balance.
 *       Use this for hackathon demo purposes when real bank transfers aren't available.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount in NGN to credit
 */
app.post('/account/simulate-deposit', [
    passport.authenticate('jwt', { session: false }),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₦1'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

    try {
        const account = await virtualAccountService.getVirtualAccountByUserId(req.user.id);
        if (!account) {
            return res.status(404).json({ msg: 'Virtual account not found. Set one up first.' });
        }

        const amount = parseFloat(req.body.amount);
        await escrowService.creditBalance(req.user.id, amount);

        const updated = await virtualAccountService.getVirtualAccountByUserId(req.user.id);
        return res.json({
            msg: `Deposit of ₦${amount.toLocaleString()} credited successfully`,
            balance: Number(updated!.balance),
            total_deposited: Number(updated!.totalDeposited),
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * @openapi
 * /account/claim:
 *   post:
 *     description: >
 *       Claim an existing virtual account by its account number.
 *       Used to link a pre-seeded real Squad account to your user.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [account_number]
 *             properties:
 *               account_number:
 *                 type: string
 */
app.post('/account/claim', [
    passport.authenticate('jwt', { session: false }),
    body('account_number').trim().notEmpty().withMessage('Account number is required'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.mapped() });

    try {
        const existing = await virtualAccountService.getVirtualAccountByUserId(req.user.id);
        if (existing) {
            return res.status(409).json({ msg: 'You already have a virtual account linked to your profile.' });
        }

        const { account_number } = matchedData(req) as { account_number: string };
        const account = await VirtualAccount.findOne({ where: { virtualAccountNumber: account_number } });
        if (!account) {
            return res.status(404).json({ msg: 'Virtual account not found.' });
        }

        await account.update({ userId: req.user.id });

        return res.json({
            msg: 'Virtual account claimed and linked to your profile.',
            virtual_account: {
                account_number: account.virtualAccountNumber,
                account_name: account.virtualAccountName,
                bank_name: account.bankName,
                bank_code: account.bankCode,
                balance: Number(account.balance ?? 0),
                total_deposited: Number(account.totalDeposited ?? 0),
            },
        });
    } catch (error) {
        return next(error);
    }
});
