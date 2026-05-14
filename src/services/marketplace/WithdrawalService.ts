import crypto from 'crypto';
import { SquadService } from '../squad/SquadService';
import { WithdrawalLog, WithdrawalLogModel } from '../../models/WithdrawalLog';
import { WITHDRAWAL_STATUS } from '../../constants/statuses';

export interface WithdrawalParams {
    amount: number;
    bank_code: string;
    account_number: string;
    account_name: string;
    remark?: string;
}

export interface WithdrawalResult {
    status: 'success' | 'pending';
    withdrawal_id: string;
    transaction_reference: string;
    amount: number;
    bank_code: string;
    account_number: string;
    account_name: string;
    withdrawal_status: string;
}

export interface RequeryResult {
    status: string;
    details?: any;
    msg?: string;
}

export class WithdrawalService {
    private squadService: SquadService;

    constructor(squadService?: SquadService) {
        this.squadService = squadService || new SquadService();
    }

    async initiateWithdrawal(userId: string, params: WithdrawalParams): Promise<WithdrawalResult> {
        const { amount, bank_code, account_number, account_name, remark } = params;

        // Reference format required by Squad: MERCHANTID_REFERENCE
        const uniquePart = crypto.randomBytes(6).toString('hex').toUpperCase();
        const transactionReference = `ARTIVO_${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}_${uniquePart}`;

        // Create pending log before calling Squad (so we have a record even if it times out)
        const withdrawalLog = await WithdrawalLog.create({
            userId,
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
            transferResponse = await this.squadService.initiateTransfer({
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
                return {
                    status: 'pending',
                    withdrawal_id: withdrawalLog.id,
                    transaction_reference: transactionReference,
                    amount,
                    bank_code,
                    account_number,
                    account_name,
                    withdrawal_status: WITHDRAWAL_STATUS.PENDING,
                };
            }
            await WithdrawalLog.update(
                { status: WITHDRAWAL_STATUS.FAILED, remarks: squadErr?.message ?? 'Squad error' },
                { where: { id: withdrawalLog.id } }
            );
            const err: any = new Error(squadErr?.message ?? 'Squad transfer error');
            err.squadError = true;
            err.details = squadErr?.message;
            throw err;
        }

        if (!transferResponse.success) {
            await WithdrawalLog.update(
                { status: WITHDRAWAL_STATUS.FAILED, remarks: (transferResponse as any).message ?? 'Squad transfer failed' },
                { where: { id: withdrawalLog.id } }
            );
            const err: any = new Error((transferResponse as any).message ?? 'Squad transfer failed');
            err.squadError = true;
            err.details = (transferResponse as any).message;
            throw err;
        }

        await WithdrawalLog.update({ status: WITHDRAWAL_STATUS.SUCCESS }, { where: { id: withdrawalLog.id } });

        return {
            status: 'success',
            withdrawal_id: withdrawalLog.id,
            transaction_reference: transactionReference,
            amount,
            bank_code,
            account_number,
            account_name,
            withdrawal_status: WITHDRAWAL_STATUS.SUCCESS,
        };
    }

    async requeryWithdrawal(userId: string, transactionReference: string): Promise<RequeryResult> {
        // Confirm this withdrawal belongs to the authenticated user
        const log = await WithdrawalLog.findOne({
            where: { squadTransactionReference: transactionReference, userId },
        });

        if (!log) {
            const err: any = new Error('Withdrawal not found');
            err.notFound = true;
            throw err;
        }

        const result = await this.squadService.requeryTransfer({ transaction_reference: transactionReference });

        if (result.success && result.data) {
            const newStatus = result.data.response_code === '00' ? WITHDRAWAL_STATUS.SUCCESS : WITHDRAWAL_STATUS.FAILED;
            await WithdrawalLog.update({ status: newStatus }, { where: { id: log.id } });
            return { status: newStatus, details: result.data };
        }

        return { status: log.status, msg: 'Could not get updated status from Squad.' };
    }

    async getWithdrawalHistory(userId: string): Promise<WithdrawalLogModel[]> {
        return WithdrawalLog.findAll({
            where: { userId },
            order: [['created_at', 'DESC']],
        });
    }
}
