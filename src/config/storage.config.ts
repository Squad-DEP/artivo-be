import dotenv from 'dotenv';
dotenv.config();

export const storageConfig = {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    endpoint: process.env.S3_URL || '',
    bucketName: process.env.S3_BUCKET_NAME || '',
    publicBucketName: process.env.S3_PUBLIC_BUCKET_NAME || '',
    publicBaseUrl: process.env.S3_PUBLIC_URL || '',
    region: 'auto',
};

export const isStorageConfigured = (): boolean => {
    return !!(
        storageConfig.accessKeyId &&
        storageConfig.secretAccessKey &&
        storageConfig.endpoint &&
        storageConfig.bucketName
    );
};
