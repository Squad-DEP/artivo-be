import { Transaction } from 'sequelize';
import { VirtualAccount, VirtualAccountModel } from '../models/VirtualAccount';

export class VirtualAccountRepository {
    async findByUserId(userId: string, t?: Transaction, lock?: boolean): Promise<VirtualAccountModel | null> {
        return VirtualAccount.findOne({
            where: { userId },
            ...(t ? { transaction: t } : {}),
            ...(lock ? { lock: true } : {}),
        });
    }

    async findByIdentifier(customerIdentifier: string): Promise<VirtualAccountModel | null> {
        return VirtualAccount.findOne({ where: { customerIdentifier } });
    }

    /**
     * Find or create a virtual account for a worker.
     * Returns the model instance (already incremented by caller if needed).
     */
    async findOrCreateForWorker(workerId: string): Promise<[VirtualAccountModel, boolean]> {
        const shortId = workerId.replace(/-/g, '').slice(0, 8).toUpperCase();
        return VirtualAccount.findOrCreate({
            where: { userId: workerId },
            defaults: {
                userId:               workerId,
                customerIdentifier:   `WORKER_${shortId}`,
                virtualAccountNumber: 'SANDBOX',
                virtualAccountName:   'Sandbox Worker Account',
                bankName:             'Artivo Sandbox',
                balance:              0,
                totalDeposited:       0,
            },
        });
    }

    async increment(userId: string, fields: { balance?: number; totalDeposited?: number }): Promise<void> {
        await VirtualAccount.increment(fields as any, { where: { userId } });
    }

    async incrementByIdentifier(customerIdentifier: string, fields: { balance?: number; totalDeposited?: number }): Promise<[any, number]> {
        return VirtualAccount.increment(fields as any, { where: { customerIdentifier } }) as any;
    }
}
