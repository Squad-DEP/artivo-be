import { Transaction } from 'sequelize';
import { EscrowEntry, EscrowEntryModel } from '../models/EscrowEntry';
import { EscrowAdvanceRequest, EscrowAdvanceRequestModel } from '../models/EscrowAdvanceRequest';

export class EscrowRepository {
    async create(data: {
        jobId: string;
        customerId: string;
        workerId: string;
        amount: number;
        status: string;
        fundedAt?: Date;
    }, t?: Transaction): Promise<EscrowEntryModel> {
        return EscrowEntry.create(data as any, { transaction: t });
    }

    async findByJobId(jobId: string, t?: Transaction, lock?: boolean): Promise<EscrowEntryModel | null> {
        return EscrowEntry.findOne({
            where: { jobId },
            ...(t ? { transaction: t } : {}),
            ...(lock ? { lock: true } : {}),
        });
    }

    async update(jobId: string, data: object, t?: Transaction): Promise<void> {
        await EscrowEntry.update(data as any, {
            where: { jobId },
            ...(t ? { transaction: t } : {}),
        });
    }

    async createAdvanceRequest(data: {
        jobId: string;
        workerId: string;
        customerId: string;
        amount: number;
        reason: string | null;
        status: string;
    }): Promise<EscrowAdvanceRequestModel> {
        return EscrowAdvanceRequest.create(data as any);
    }

    async findAdvanceRequestById(id: string): Promise<EscrowAdvanceRequestModel | null> {
        return EscrowAdvanceRequest.findByPk(id);
    }

    async findApprovedAdvances(jobId: string): Promise<EscrowAdvanceRequestModel[]> {
        return EscrowAdvanceRequest.findAll({ where: { jobId, status: 'approved' } });
    }

    async findAllAdvances(jobId: string): Promise<EscrowAdvanceRequestModel[]> {
        return EscrowAdvanceRequest.findAll({
            where: { jobId },
            order: [['requestedAt', 'DESC']],
        });
    }

    async findByCustomer(customerId: string, statuses?: string[]): Promise<EscrowEntryModel[]> {
        const where: any = { customerId };
        if (statuses?.length) where.status = statuses;
        return EscrowEntry.findAll({ where, order: [['createdAt', 'DESC']] });
    }

    async updateAdvanceRequest(id: string, data: object): Promise<void> {
        await EscrowAdvanceRequest.update(data as any, { where: { id } });
    }
}
