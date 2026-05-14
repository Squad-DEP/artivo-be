import { Document, DocumentCreationAttributes } from '../../models/Document';
import { IStorageProvider } from './IStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';

export class DocumentService {
    private storageProvider: IStorageProvider;

    constructor(storageProvider?: IStorageProvider) {
        this.storageProvider = storageProvider || new S3StorageProvider();
    }

    async initiateUpload(params: {
        userId: string;
        fileName: string;
        contentType: string;
        documentType: DocumentCreationAttributes['documentType'];
        fileSize?: number;
        description?: string;
    }) {
        const { userId, fileName, contentType, documentType, fileSize, description } = params;

        const { uploadUrl, fileKey, publicUrl } = await this.storageProvider.getPresignedUploadUrl(
            userId,
            fileName,
            contentType,
            3600,
            documentType
        );

        const document = await Document.create({
            userId,
            documentType,
            fileKey,
            fileUrl: publicUrl,
            fileName,
            fileSize,
            mimeType: contentType,
            description: description || undefined,
            uploadStatus: 'pending',
        });

        return { document, uploadUrl };
    }

    async confirmUpload(documentId: string, userId: string) {
        const document = await Document.findOne({ where: { id: documentId, userId } });
        if (!document) throw new Error('Document not found');
        if (document.uploadStatus === 'uploaded') return document;

        await document.update({ uploadStatus: 'uploaded' });
        return document;
    }

    async markFailed(documentId: string, userId: string) {
        const document = await Document.findOne({ where: { id: documentId, userId } });
        if (!document) return;
        await document.update({ uploadStatus: 'failed' });
    }

    async getUserDocuments(userId: string, documentType?: string) {
        const where: Record<string, unknown> = { userId, uploadStatus: 'uploaded' };
        if (documentType) where.documentType = documentType;
        return Document.findAll({ where });
    }

    async getDocumentById(id: string) {
        return Document.findByPk(id);
    }

    async deleteDocument(id: string, userId: string) {
        const document = await Document.findOne({ where: { id, userId } });
        if (!document) throw new Error('Document not found');

        const isPublic = ['profile_photo', 'business_card', 'generated_card'].includes(document.documentType);
        await this.storageProvider.deleteObject(document.fileKey, isPublic);
        await document.destroy();
        return true;
    }
}
