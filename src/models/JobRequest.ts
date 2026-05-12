import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export type JobRequestStatus = 'open' | 'assigned' | 'completed' | 'cancelled';

export interface JobRequestModel extends Model<InferAttributes<JobRequestModel>, InferCreationAttributes<JobRequestModel>> {
    id: CreationOptional<string>;
    customerId: string;
    jobTypeId: string;
    title: string;
    description: CreationOptional<string> | null;
    location: CreationOptional<string> | null;
    budget: CreationOptional<number> | null;
    status: CreationOptional<JobRequestStatus>;
    createdAt: CreationOptional<Date>;
}

export const JobRequest = sequelize.define<JobRequestModel>('job_request', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'customer_id',
    },
    jobTypeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'job_type_id',
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    location: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    budget: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'open',
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
}, {
    tableName: 'job_requests',
    timestamps: false,
});
