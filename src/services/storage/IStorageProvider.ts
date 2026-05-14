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

    deleteObject(fileKey: string, isPublic?: boolean): Promise<void>;
    getPublicUrl(fileKey: string): string;
    getPublicBucketUrl(fileKey: string): string;
}
