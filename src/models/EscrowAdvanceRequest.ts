import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export type AdvanceRequestStatus = 'pending' | 'approved' | 'rejected';

export interface EscrowAdvanceRequestModel extends Model<
    InferAttributes<EscrowAdvanceRequestModel>,
    InferCreationAttributes<EscrowAdvanceRequestModel>
> {
    id: CreationOptional<string>;
    jobId: string;
    workerId: string;
    customerId: string;
    amount: number;
    reason: CreationOptional<string> | null;
    status: CreationOptional<AdvanceRequestStatus>;
    requestedAt: CreationOptional<Date>;
    approvedAt: CreationOptional<Date> | null;
}

export const EscrowAdvanceRequest = sequelize.define<EscrowAdvanceRequestModel>('escrow_advance_request', {
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
    workerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'worker_id',
    },
    customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'customer_id',
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
    },
    requestedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'requested_at',
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'approved_at',
    },
}, {
    tableName: 'escrow_advance_requests',
    timestamps: false,
});
