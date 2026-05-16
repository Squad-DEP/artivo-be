import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

export interface OrgApplicationModel extends Model<InferAttributes<OrgApplicationModel>, InferCreationAttributes<OrgApplicationModel>> {
    id: CreationOptional<string>;
    organizationId: string;
    phone: string;
    fullName: CreationOptional<string> | null;
    status: CreationOptional<string>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}

export const OrgApplication = sequelize.define<OrgApplicationModel>('org_application', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'organization_id',
    },
    phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
    },
    fullName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'full_name',
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
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
    tableName: 'org_applications',
    underscored: true,
});
