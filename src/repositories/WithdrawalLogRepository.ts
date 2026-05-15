import { WithdrawalLog, WithdrawalLogModel } from '../models/WithdrawalLog';

export class WithdrawalLogRepository {
    async create(data: {
        userId: string;
        squadTransactionReference: string;
        amount: number;
        bankCode: string;
        accountNumber: string;
        accountName: string;
        status: string;
        remarks: string;
    }): Promise<WithdrawalLogModel> {
        return WithdrawalLog.create(data as any);
    }

    async updateStatus(id: string, status: string): Promise<void> {
        await WithdrawalLog.update({ status: status as any }, { where: { id } });
    }
}
