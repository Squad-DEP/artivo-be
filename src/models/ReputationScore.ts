import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface ReputationScoreModel extends Model<InferAttributes<ReputationScoreModel>, InferCreationAttributes<ReputationScoreModel>> {
    userId: string;
    creditScore: CreationOptional<number>;
    completionRate: CreationOptional<number>;
    totalJobs: CreationOptional<number>;
    averageRating: CreationOptional<number>;
    updatedAt: CreationOptional<Date>;
}

export const ReputationScore = sequelize.define<ReputationScoreModel>('reputation_score', {
    userId: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        field: 'user_id',
    },
    creditScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'credit_score',
    },
    completionRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'completion_rate',
    },
    totalJobs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'total_jobs',
    },
    averageRating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'average_rating',
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
    },
}, {
    tableName: 'reputation_scores',
    timestamps: false,
});
