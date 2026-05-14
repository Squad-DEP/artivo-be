import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export type JobProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface JobProposalModel extends Model<InferAttributes<JobProposalModel>, InferCreationAttributes<JobProposalModel>> {
    id: CreationOptional<string>;
    jobRequestId: string;
    workerId: string;
    proposedAmount: number;
    proposedAmountMax: CreationOptional<number | null>;
    status: CreationOptional<JobProposalStatus>;
    createdAt: CreationOptional<Date>;
}

export const JobProposal = sequelize.define<JobProposalModel>('job_proposal', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    jobRequestId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'job_request_id',
    },
    workerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'worker_id',
    },
    proposedAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'proposed_amount',
    },
    proposedAmountMax: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'proposed_amount_max',
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
}, {
    tableName: 'job_proposals',
    timestamps: false,
});
