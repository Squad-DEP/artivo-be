import { body, validationResult } from 'express-validator';
import passport from './../providers/Passport';
import express from 'express';
import crypto from 'crypto';
import { VirtualAccountService } from '../services/squad/VirtualAccountService';
import { SquadService } from '../services/squad/SquadService';
import { WithdrawalLog } from '../models/WithdrawalLog';
import { WITHDRAWAL_STATUS } from '../constants/statuses';

export const app = express.Router();

const virtualAccountService = new VirtualAccountService();
const squadService = new SquadService();

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

        // Reference format required by Squad: MERCHANTID_REFERENCE
        const uniquePart = crypto.randomBytes(6).toString('hex').toUpperCase();
        const transactionReference = `ARTIVO_${req.user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}_${uniquePart}`;

        // Create pending log before calling Squad (so we have a record even if it times out)
        const withdrawalLog = await WithdrawalLog.create({
            userId: req.user.id,
            squadTransactionReference: transactionReference,
            amount,
            bankCode: bank_code,
            accountNumber: account_number,
            accountName: account_name,
            status: WITHDRAWAL_STATUS.PENDING,
            remarks: remark ?? null,
        });

        let transferResponse;
        try {
            transferResponse = await squadService.initiateTransfer({
                transaction_reference: transactionReference,
                amount: String(Math.round(amount * 100)), // NGN → kobo as string
                bank_code,
                account_number,
                account_name,
                currency_id: 'NGN',
                remark: remark || `Artivo withdrawal`,
            });
        } catch (squadErr: any) {
            // 424 timeout — caller should requery; leave status as 'pending'
            if (squadErr?.statusCode === 424) {
                return res.status(202).json({
                    msg: 'Transfer is pending. Please check status via /account/withdraw/requery.',
                    withdrawal_id: withdrawalLog.id,
                    transaction_reference: transactionReference,
                });
            }
            await WithdrawalLog.update(
                { status: WITHDRAWAL_STATUS.FAILED, remarks: squadErr?.message ?? 'Squad error' },
                { where: { id: withdrawalLog.id } }
            );
            return res.status(400).json({
                msg: 'Withdrawal failed.',
                details: squadErr?.message,
            });
        }

        if (!transferResponse.success) {
            await WithdrawalLog.update(
                { status: WITHDRAWAL_STATUS.FAILED, remarks: (transferResponse as any).message ?? 'Squad transfer failed' },
                { where: { id: withdrawalLog.id } }
            );
            return res.status(400).json({
                msg: 'Withdrawal failed. Please try again or contact support.',
                details: (transferResponse as any).message,
            });
        }

        await WithdrawalLog.update({ status: WITHDRAWAL_STATUS.SUCCESS }, { where: { id: withdrawalLog.id } });

        return res.json({
            msg: 'Withdrawal initiated successfully',
            withdrawal: {
                id: withdrawalLog.id,
                transaction_reference: transactionReference,
                amount,
                bank_code,
                account_number,
                account_name,
                status: WITHDRAWAL_STATUS.SUCCESS,
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

        // Confirm this withdrawal belongs to the authenticated user
        const log = await WithdrawalLog.findOne({
            where: { squadTransactionReference: transaction_reference, userId: req.user.id },
        });
        if (!log) {
            return res.status(404).json({ msg: 'Withdrawal not found.' });
        }

        const result = await squadService.requeryTransfer({ transaction_reference });

        if (result.success && result.data) {
            const newStatus = result.data.response_code === '00' ? WITHDRAWAL_STATUS.SUCCESS : WITHDRAWAL_STATUS.FAILED;
            await WithdrawalLog.update({ status: newStatus }, { where: { id: log.id } });
            return res.json({ status: newStatus, details: result.data });
        }

        return res.json({ status: log.status, msg: 'Could not get updated status from Squad.' });
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
        const withdrawals = await WithdrawalLog.findAll({
            where: { userId: req.user.id },
            order: [['created_at', 'DESC']],
        });
        return res.json({ withdrawals });
    } catch (error) {
        return next(error);
    }
});
