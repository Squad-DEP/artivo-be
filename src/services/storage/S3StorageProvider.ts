import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storageConfig } from '../../config/storage.config';
import { IStorageProvider, PresignedUploadResult } from './IStorageProvider';
import { v4 as uuidv4 } from 'uuid';

// All uploads go to the public bucket — fileUrl is always the stable r2.dev CDN URL.

export class S3StorageProvider implements IStorageProvider {
    private client: S3Client;
    private publicBucketName: string;

    constructor() {
        this.publicBucketName = storageConfig.publicBucketName;

        this.client = new S3Client({
            region: storageConfig.region,
            endpoint: storageConfig.endpoint,
            credentials: {
                accessKeyId: storageConfig.accessKeyId,
                secretAccessKey: storageConfig.secretAccessKey,
            },
            forcePathStyle: true,
            // Disable SDK-level checksum injection — R2 doesn't require them and
            // the browser can't compute CRC32 on a bare fetch PUT.
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
    }

    async getPresignedUploadUrl(
        userId: string,
        fileName: string,
        contentType: string,
        expiresIn: number = 3600,
        _documentType?: string
    ): Promise<PresignedUploadResult> {
        const ext = fileName.split('.').pop();
        const fileKey = `${userId}/${uuidv4()}.${ext}`;
        const command = new PutObjectCommand({
            Bucket: this.publicBucketName,
            Key: fileKey,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

        return {
            uploadUrl,
            fileKey,
            publicUrl: this.getPublicBucketUrl(fileKey),
        };
    }

    async deleteObject(fileKey: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.publicBucketName,
            Key: fileKey,
        }));
    }

    // r2.dev public URL — directly accessible without presigning
    getPublicBucketUrl(fileKey: string): string {
        return `${storageConfig.publicBaseUrl}/${fileKey}`;
    }
}
