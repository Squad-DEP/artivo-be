import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../providers/db';
import { DataTypes } from 'sequelize';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         full_name:
 *           type: string
 *         role:
 *           type: string
 *           enum: [worker, customer]
 *         created_at:
 *           type: string
 *           format: date-time
 */

interface UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
    id: CreationOptional<string>;
    email: string;
    phone: CreationOptional<string> | null;
    fullName: string;
    dob: CreationOptional<string> | null; // ISO date string YYYY-MM-DD, stored as DATE in DB
    role: 'worker' | 'customer';
    password: CreationOptional<string> | null;
    passwordResetKey: CreationOptional<string> | null;
    emailVerificationKey: CreationOptional<string> | null;
    emailVerified: CreationOptional<boolean>;
    onboarded: CreationOptional<boolean>;
    createdAt: CreationOptional<Date>;
}

const User = sequelize.define<UserModel>('user', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        unique: true,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    dob: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    fullName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'full_name',
    },
    role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['worker', 'customer']],
        },
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    passwordResetKey: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'password_reset_key',
    },
    emailVerificationKey: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'email_verification_key',
    },
    emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'email_verified',
    },
    onboarded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
    },
}, {
    tableName: 'users',
    timestamps: false,
    defaultScope: {
        attributes: {
            exclude: [
                'password',
                'passwordResetKey',
                'emailVerificationKey',
            ],
        },
    },
});

export default User;

export {
    UserModel,
    User,
};
