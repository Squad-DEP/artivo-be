export interface PresignedUploadResult {
    uploadUrl: string;
    fileKey: string;
    publicUrl: string;
}

export interface IStorageProvider {
    getPresignedUploadUrl(
        userId: string,
        fileName: string,
        contentType: string,
        expiresIn?: number,
        documentType?: string
    ): Promise<PresignedUploadResult>;

    deleteObject(fileKey: string): Promise<void>;
    getPublicBucketUrl(fileKey: string): string;
}
