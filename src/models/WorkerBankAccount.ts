import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface WorkerBankAccountModel extends Model<
    InferAttributes<WorkerBankAccountModel>,
    InferCreationAttributes<WorkerBankAccountModel>
> {
    id: CreationOptional<string>;
    userId: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
    accountName: string;
    verified: CreationOptional<boolean>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}

export const WorkerBankAccount = sequelize.define<WorkerBankAccountModel>('worker_bank_account', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        field: 'user_id',
    },
    accountNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'account_number',
    },
    bankCode: {
        type: DataTypes.STRING(10),
        allowNull: false,
        field: 'bank_code',
    },
    bankName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'bank_name',
    },
    accountName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'account_name',
    },
    verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    tableName: 'worker_bank_accounts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
