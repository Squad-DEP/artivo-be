import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'paid';

export interface JobModel extends Model<InferAttributes<JobModel>, InferCreationAttributes<JobModel>> {
    id: CreationOptional<string>;
    jobRequestId: string;
    workerId: string;
    customerId: string;
    amount: number;
    status: CreationOptional<JobStatus>;
    completedAt: CreationOptional<Date> | null;
    createdAt: CreationOptional<Date>;
}

export const Job = sequelize.define<JobModel>('job', {
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
    customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'customer_id',
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
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at',
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
}, {
    tableName: 'jobs',
    timestamps: false,
});
