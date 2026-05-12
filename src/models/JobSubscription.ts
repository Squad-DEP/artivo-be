import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface JobSubscriptionModel extends Model<InferAttributes<JobSubscriptionModel>, InferCreationAttributes<JobSubscriptionModel>> {
    id: CreationOptional<string>;
    workerId: string;
    jobTypeId: string;
    createdAt: CreationOptional<Date>;
}

export const JobSubscription = sequelize.define<JobSubscriptionModel>('job_subscription', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    workerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'worker_id',
    },
    jobTypeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'job_type_id',
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
}, {
    tableName: 'job_subscriptions',
    timestamps: false,
});
