import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface WorkerEducationModel extends Model<InferAttributes<WorkerEducationModel>, InferCreationAttributes<WorkerEducationModel>> {
    id: CreationOptional<string>;
    userId: string;
    title: string;
    institution: string;
    year: CreationOptional<number> | null;
    createdAt: CreationOptional<Date>;
}

export const WorkerEducation = sequelize.define<WorkerEducationModel>('worker_education', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    title: { type: DataTypes.STRING(255), allowNull: false },
    institution: { type: DataTypes.STRING(255), allowNull: false },
    year: { type: DataTypes.SMALLINT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
}, { tableName: 'worker_education', timestamps: false });
