import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface ReviewModel extends Model<InferAttributes<ReviewModel>, InferCreationAttributes<ReviewModel>> {
    id: CreationOptional<string>;
    jobId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment: CreationOptional<string> | null;
    createdAt: CreationOptional<Date>;
}

export const Review = sequelize.define<ReviewModel>('review', {
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
    reviewerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'reviewer_id',
    },
    revieweeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'reviewee_id',
    },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 5,
        },
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
}, {
    tableName: 'reviews',
    timestamps: false,
});
