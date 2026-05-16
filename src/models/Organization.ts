import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface OrganizationModel extends Model<InferAttributes<OrganizationModel>, InferCreationAttributes<OrganizationModel>> {
    id: CreationOptional<string>;
    name: string;
    description: CreationOptional<string> | null;
    logoUrl: CreationOptional<string> | null;
    sector: CreationOptional<string> | null;
    contactEmail: CreationOptional<string> | null;
    website: CreationOptional<string> | null;
    isActive: CreationOptional<boolean>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}

export const Organization = sequelize.define<OrganizationModel>('organization', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    logoUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'logo_url',
    },
    sector: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    contactEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'contact_email',
    },
    website: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
    },
    createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
    },
    updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
    },
}, {
    tableName: 'organizations',
    underscored: true,
});
