import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

interface VirtualAccountModel extends Model<InferAttributes<VirtualAccountModel>, InferCreationAttributes<VirtualAccountModel>> {
    id: CreationOptional<string>;
    userId: string;
    customerIdentifier: string;
    virtualAccountNumber: string;
    virtualAccountName: string;
    bankName: string;
    bankCode: CreationOptional<string> | null;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}

const VirtualAccount = sequelize.define<VirtualAccountModel>('virtual_account', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        field: 'user_id',
    },
    customerIdentifier: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'customer_identifier',
    },
    virtualAccountNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'virtual_account_number',
    },
    virtualAccountName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'virtual_account_name',
    },
    bankName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'bank_name',
    },
    bankCode: {
        type: DataTypes.STRING(10),
        allowNull: true,
        field: 'bank_code',
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
    },
}, {
    tableName: 'virtual_accounts',
    timestamps: true,
    updatedAt: 'updated_at',
    createdAt: 'created_at',
});

export default VirtualAccount;

export {
    VirtualAccountModel,
    VirtualAccount,
};
