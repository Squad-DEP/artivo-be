import dotenv from 'dotenv';
dotenv.config();

export const storageConfig = {
    accountId: process.env.STORAGE_ACCOUNT_ID || '',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    bucketName: process.env.STORAGE_BUCKET_NAME || '',
    publicUrl: process.env.STORAGE_PUBLIC_URL || '',
    endpoint: process.env.STORAGE_ENDPOINT || '',
    region: process.env.STORAGE_REGION || 'auto',
};

export const isStorageConfigured = (): boolean => {
    return !!(
        storageConfig.accessKeyId &&
        storageConfig.secretAccessKey &&
        storageConfig.bucketName
    );
};
