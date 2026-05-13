import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export type WithdrawalStatus = 'pending' | 'success' | 'failed';

export interface WithdrawalLogModel extends Model<InferAttributes<WithdrawalLogModel>, InferCreationAttributes<WithdrawalLogModel>> {
    id: CreationOptional<string>;
    userId: string;
    squadTransactionReference: CreationOptional<string> | null;
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: CreationOptional<string> | null;
    status: CreationOptional<WithdrawalStatus>;
    remarks: CreationOptional<string> | null;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}

export const WithdrawalLog = sequelize.define<WithdrawalLogModel>('withdrawal_log', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
    },
    squadTransactionReference: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        field: 'squad_transaction_reference',
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    bankCode: {
        type: DataTypes.STRING(10),
        allowNull: false,
        field: 'bank_code',
    },
    accountNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'account_number',
    },
    accountName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'account_name',
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
    },
}, {
    tableName: 'withdrawal_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
