import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storageConfig } from '../../config/storage.config';
import { IStorageProvider, PresignedUploadResult } from './IStorageProvider';
import { v4 as uuidv4 } from 'uuid';

// Document types that go into the public bucket (no presigning needed)
const PUBLIC_DOCUMENT_TYPES = new Set(['profile_photo', 'business_card', 'generated_card']);

export class S3StorageProvider implements IStorageProvider {
    private client: S3Client;
    private bucketName: string;
    private publicBucketName: string;

    constructor() {
        this.bucketName = storageConfig.bucketName;
        this.publicBucketName = storageConfig.publicBucketName;

        this.client = new S3Client({
            region: storageConfig.region,
            endpoint: storageConfig.endpoint,
            credentials: {
                accessKeyId: storageConfig.accessKeyId,
                secretAccessKey: storageConfig.secretAccessKey,
            },
            forcePathStyle: true,
        });
    }

    async getPresignedUploadUrl(
        userId: string,
        fileName: string,
        contentType: string,
        expiresIn: number = 3600,
        documentType?: string
    ): Promise<PresignedUploadResult> {
        const ext = fileName.split('.').pop();
        const fileKey = `${userId}/${uuidv4()}.${ext}`;
        const isPublic = documentType ? PUBLIC_DOCUMENT_TYPES.has(documentType) : false;
        const bucket = isPublic ? this.publicBucketName : this.bucketName;

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: fileKey,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

        return {
            uploadUrl,
            fileKey,
            publicUrl: isPublic ? this.getPublicBucketUrl(fileKey) : this.getPublicUrl(fileKey),
        };
    }

    async deleteObject(fileKey: string, isPublic = false): Promise<void> {
        const bucket = isPublic ? this.publicBucketName : this.bucketName;
        await this.client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: fileKey,
        }));
    }

    // Private bucket URL (for displaying already-uploaded objects, not for direct access)
    getPublicUrl(fileKey: string): string {
        return `${storageConfig.endpoint}/${this.bucketName}/${fileKey}`;
    }

    // r2.dev public URL — directly accessible without presigning
    getPublicBucketUrl(fileKey: string): string {
        return `${storageConfig.publicBaseUrl}/${fileKey}`;
    }
}
