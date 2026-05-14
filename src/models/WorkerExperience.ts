import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface WorkerExperienceModel extends Model<InferAttributes<WorkerExperienceModel>, InferCreationAttributes<WorkerExperienceModel>> {
    id: CreationOptional<string>;
    userId: string;
    title: string;
    company: string;
    startYear: number;
    endYear: CreationOptional<number> | null;
    description: CreationOptional<string> | null;
    createdAt: CreationOptional<Date>;
}

export const WorkerExperience = sequelize.define<WorkerExperienceModel>('worker_experience', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    title: { type: DataTypes.STRING(255), allowNull: false },
    company: { type: DataTypes.STRING(255), allowNull: false },
    startYear: { type: DataTypes.SMALLINT, allowNull: false, field: 'start_year' },
    endYear: { type: DataTypes.SMALLINT, allowNull: true, field: 'end_year' },
    description: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
}, { tableName: 'worker_experience', timestamps: false });
