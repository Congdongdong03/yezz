import type { Db } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import { getStorageConfig, uploadImage } from "../../lib/storage.js";
import { createMediaRepository } from "../../repositories/media.repository.js";

export type UploadResult = {
  id: string;
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
};

export type AdminUploadService = ReturnType<typeof createAdminUploadService>;

export function createAdminUploadService(db: Db) {
  const mediaRepo = createMediaRepository(db);

  return {
    async uploadFile(params: {
      buffer: Buffer;
      mimeType: string;
      filename?: string;
      uploadedById?: string;
    }): Promise<UploadResult> {
      if (!getStorageConfig()) {
        throw new AppError(
          503,
          "STORAGE_UNAVAILABLE",
          "File storage is not configured (set S3_* env vars)",
        );
      }

      try {
        const uploaded = await uploadImage({
          buffer: params.buffer,
          mimeType: params.mimeType,
          originalFilename: params.filename,
        });

        const asset = await mediaRepo.create({
          objectKey: uploaded.key,
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          uploadedById: params.uploadedById ?? null,
        });

        return {
          id: asset.id,
          url: asset.url,
          key: asset.objectKey,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        if (message.includes("Unsupported file type")) {
          throw new AppError(400, "VALIDATION_ERROR", message);
        }
        throw new AppError(500, "UPLOAD_FAILED", message);
      }
    },
  };
}
