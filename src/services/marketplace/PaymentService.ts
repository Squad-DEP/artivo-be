import { PaymentLog, PaymentLogModel } from '../../models/PaymentLog';
import { JobService } from './JobService';

export interface CreatePaymentLogDTO {
    jobId: string;
    squadTransactionId: string;
    amount: number;
    status: string;
}

export class PaymentService {
    private jobService: JobService;

    constructor(jobService: JobService) {
        this.jobService = jobService;
    }

    async logPayment(data: CreatePaymentLogDTO): Promise<PaymentLogModel> {
        const paymentLog = await PaymentLog.create({
            jobId: data.jobId,
            squadTransactionId: data.squadTransactionId,
            amount: data.amount,
            status: data.status,
        });

        // Update job status to paid if payment successful
        if (data.status === 'success' || data.status === 'completed') {
            await this.jobService.updateJobStatus(data.jobId, 'paid');
        }

        return paymentLog;
    }

    async getPaymentLogsByJob(jobId: string): Promise<PaymentLogModel[]> {
        return PaymentLog.findAll({
            where: { jobId },
            order: [['createdAt', 'DESC']],
        });
    }

    async getPaymentLogByTransactionId(squadTransactionId: string): Promise<PaymentLogModel | null> {
        return PaymentLog.findOne({
            where: { squadTransactionId },
        });
    }
}
