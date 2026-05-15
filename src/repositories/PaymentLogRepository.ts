import { PaymentLog, PaymentLogModel } from '../models/PaymentLog';

export class PaymentLogRepository {
    async create(data: {
        jobId: string;
        squadTransactionId: string;
        amount: number;
        status: string;
    }): Promise<PaymentLogModel> {
        return PaymentLog.create(data as any);
    }

    async findByJobId(jobId: string): Promise<PaymentLogModel[]> {
        return PaymentLog.findAll({ where: { jobId }, order: [['createdAt', 'DESC']] });
    }

    async findByTransactionId(squadTransactionId: string): Promise<PaymentLogModel | null> {
        return PaymentLog.findOne({ where: { squadTransactionId } });
    }
}
