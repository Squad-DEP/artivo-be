import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

/**
 * Idempotency guard for incoming Squad webhooks.
 *
 * Every transaction_ref we successfully process is written here so that
 * Squad retries (or replay attacks) are silently acknowledged with 200
 * without being re-processed.
 *
 * Backfilled from payment_logs on first migration so existing transactions
 * are protected from day one.
 */
export interface ProcessedWebhookModel
    extends Model<InferAttributes<ProcessedWebhookModel>, InferCreationAttributes<ProcessedWebhookModel>> {
    transactionRef: string;
    processedAt:    CreationOptional<Date>;
}

export const ProcessedWebhook = sequelize.define<ProcessedWebhookModel>('processed_webhook', {
    transactionRef: {
        type:       DataTypes.STRING(255),
        primaryKey: true,
        allowNull:  false,
        field:      'transaction_ref',
    },
    processedAt: {
        type:         DataTypes.DATE,
        allowNull:    false,
        defaultValue: DataTypes.NOW,
        field:        'processed_at',
    },
}, {
    tableName:  'processed_webhooks',
    timestamps: false,
});
