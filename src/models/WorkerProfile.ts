import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface WorkerProfileModel extends Model<InferAttributes<WorkerProfileModel>, InferCreationAttributes<WorkerProfileModel>> {
    userId: string;
    displayName: string;
    photoUrl: CreationOptional<string> | null;
    bio: CreationOptional<string> | null;
    tagline: CreationOptional<string> | null;
    skills: CreationOptional<string[]>;
    location: CreationOptional<string> | null;
    shareSlug: string;
    hourlyRate: CreationOptional<number> | null;
    minimumBudget: CreationOptional<number> | null;
    languages: CreationOptional<string[]>;
    availability: CreationOptional<string>;
    categories: CreationOptional<string[]>;
    createdAt: CreationOptional<Date>;
}

export const WorkerProfile = sequelize.define<WorkerProfileModel>('worker_profile', {
    userId: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        field: 'user_id',
    },
    displayName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'display_name',
    },
    photoUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'photo_url',
    },
    bio: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    tagline: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    skills: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
        defaultValue: [],
    },
    location: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    shareSlug: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        field: 'share_slug',
    },
    hourlyRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'hourly_rate',
    },
    minimumBudget: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'minimum_budget',
    },
    languages: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: false,
        defaultValue: [],
    },
    availability: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'available',
    },
    categories: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: false,
        defaultValue: [],
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
}, {
    tableName: 'worker_profiles',
    timestamps: false,
});
