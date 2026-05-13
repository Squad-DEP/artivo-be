import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export type EscrowStatus = 'pending' | 'funded' | 'released' | 'refunded' | 'disputed';

export interface EscrowEntryModel extends Model<InferAttributes<EscrowEntryModel>, InferCreationAttributes<EscrowEntryModel>> {
    id: CreationOptional<string>;
    jobId: string;
    customerId: string;
    workerId: string;
    amount: number;
    status: CreationOptional<EscrowStatus>;
    fundedAt: CreationOptional<Date> | null;
    releasedAt: CreationOptional<Date> | null;
    workerConfirmed: CreationOptional<boolean>;
    customerConfirmed: CreationOptional<boolean>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}

export const EscrowEntry = sequelize.define<EscrowEntryModel>('escrow_entry', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    jobId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        field: 'job_id',
    },
    customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'customer_id',
    },
    workerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'worker_id',
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
    },
    fundedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'funded_at',
    },
    releasedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'released_at',
    },
    workerConfirmed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'worker_confirmed',
    },
    customerConfirmed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'customer_confirmed',
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
    tableName: 'escrow_entries',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
