import { Document, DocumentCreationAttributes } from '../../models/Document';
import { IStorageProvider } from './IStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';

export class DocumentService {
    private storageProvider: IStorageProvider;

    constructor(storageProvider?: IStorageProvider) {
        this.storageProvider = storageProvider || new S3StorageProvider();
    }

    async createDocument(data: DocumentCreationAttributes) {
        return await Document.create(data);
    }

    async getUserDocuments(userId: string, documentType?: string) {
        const where: any = { userId };
        if (documentType) {
            where.documentType = documentType;
        }
        return await Document.findAll({ where });
    }

    async getDocumentById(id: string) {
        return await Document.findByPk(id);
    }

    async deleteDocument(id: string, userId: string) {
        const document = await Document.findOne({ where: { id, userId } });
        if (!document) {
            throw new Error('Document not found');
        }
        await document.destroy();
        return true;
    }

    async getPresignedUploadUrl(
        userId: string,
        fileName: string,
        contentType: string
    ) {
        return await this.storageProvider.getPresignedUploadUrl(userId, fileName, contentType);
    }
}
