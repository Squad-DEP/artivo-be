import { WorkerBankAccount, WorkerBankAccountModel } from '../models/WorkerBankAccount';

export class WorkerBankAccountRepository {
    async findByUserId(userId: string): Promise<WorkerBankAccountModel | null> {
        return WorkerBankAccount.findOne({ where: { userId } });
    }
}
