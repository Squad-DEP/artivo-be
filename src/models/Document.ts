import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../providers/db';

export interface DocumentAttributes {
    id: string;
    userId: string;
    documentType: 'profile_photo' | 'certificate' | 'business_card' | 'generated_card' | 'other';
    fileKey: string;
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadStatus: 'pending' | 'uploaded' | 'failed';
    description?: string;
    metadata?: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface DocumentCreationAttributes extends Optional<DocumentAttributes, 'id' | 'uploadStatus' | 'createdAt' | 'updatedAt'> {}

export interface DocumentModel extends Model<DocumentAttributes, DocumentCreationAttributes>, DocumentAttributes {}

export const Document = sequelize.define<DocumentModel>('Document', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
    },
    documentType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'document_type',
    },
    fileKey: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'file_key',
    },
    fileUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'file_url',
    },
    fileName: {
        type: DataTypes.STRING(255),
        field: 'file_name',
    },
    fileSize: {
        type: DataTypes.BIGINT,
        field: 'file_size',
    },
    mimeType: {
        type: DataTypes.STRING(100),
        field: 'mime_type',
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    uploadStatus: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        field: 'upload_status',
    },
    metadata: {
        type: DataTypes.JSONB,
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
    tableName: 'documents',
    timestamps: true,
    underscored: true,
});
