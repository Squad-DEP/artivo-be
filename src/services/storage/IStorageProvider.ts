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
        expiresIn?: number
    ): Promise<PresignedUploadResult>;

    getPublicUrl(fileKey: string): string;
}
