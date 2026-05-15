import { ProcessedWebhook, ProcessedWebhookModel } from '../models/ProcessedWebhook';

export class ProcessedWebhookRepository {
    async findByRef(ref: string): Promise<ProcessedWebhookModel | null> {
        return ProcessedWebhook.findByPk(ref);
    }

    async markProcessed(ref: string): Promise<void> {
        await ProcessedWebhook.findOrCreate({ where: { transactionRef: ref } });
    }
}
