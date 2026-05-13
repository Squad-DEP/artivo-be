import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storageConfig } from '../../config/storage.config';
import { IStorageProvider, PresignedUploadResult } from './IStorageProvider';
import { v4 as uuidv4 } from 'uuid';

export class S3StorageProvider implements IStorageProvider {
    private client: S3Client;
    private bucketName: string;

    constructor() {
        this.bucketName = storageConfig.bucketName;
        
        const clientConfig: any = {
            region: storageConfig.region,
            credentials: {
                accessKeyId: storageConfig.accessKeyId,
                secretAccessKey: storageConfig.secretAccessKey,
            },
        };

        if (storageConfig.endpoint) {
            clientConfig.endpoint = storageConfig.endpoint;
        }

        this.client = new S3Client(clientConfig);
    }

    async getPresignedUploadUrl(
        userId: string,
        fileName: string,
        contentType: string,
        expiresIn: number = 3600
    ): Promise<PresignedUploadResult> {
        const fileExtension = fileName.split('.').pop();
        const fileKey = `${userId}/${uuidv4()}.${fileExtension}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
        const publicUrl = this.getPublicUrl(fileKey);

        return {
            uploadUrl,
            fileKey,
            publicUrl,
        };
    }

    getPublicUrl(fileKey: string): string {
        if (storageConfig.publicUrl) {
            return `${storageConfig.publicUrl}/${fileKey}`;
        }
        
        if (storageConfig.endpoint) {
            return `${storageConfig.endpoint}/${this.bucketName}/${fileKey}`;
        }

        return `https://${this.bucketName}.s3.${storageConfig.region}.amazonaws.com/${fileKey}`;
    }
}
