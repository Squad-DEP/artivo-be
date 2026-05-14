import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface WorkerPortfolioModel extends Model<InferAttributes<WorkerPortfolioModel>, InferCreationAttributes<WorkerPortfolioModel>> {
    id: CreationOptional<string>;
    userId: string;
    title: string;
    description: CreationOptional<string> | null;
    imageUrl: CreationOptional<string> | null;
    images: CreationOptional<string[]>;
    category: CreationOptional<string> | null;
    createdAt: CreationOptional<Date>;
}

export const WorkerPortfolio = sequelize.define<WorkerPortfolioModel>('worker_portfolio', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    imageUrl: { type: DataTypes.TEXT, allowNull: true, field: 'image_url' },
    images: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    category: { type: DataTypes.STRING(100), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
}, { tableName: 'worker_portfolio', timestamps: false });
