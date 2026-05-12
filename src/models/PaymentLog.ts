import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface PaymentLogModel extends Model<InferAttributes<PaymentLogModel>, InferCreationAttributes<PaymentLogModel>> {
    id: CreationOptional<string>;
    jobId: string;
    squadTransactionId: string;
    amount: number;
    status: string;
    createdAt: CreationOptional<Date>;
}

export const PaymentLog = sequelize.define<PaymentLogModel>('payment_log', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    jobId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'job_id',
    },
    squadTransactionId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'squad_transaction_id',
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
}, {
    tableName: 'payment_logs',
    timestamps: false,
});
