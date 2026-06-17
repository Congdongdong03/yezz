import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type StorageConfig = {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
};

export function getStorageConfig(): StorageConfig | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKey = process.env.S3_ACCESS_KEY?.trim();
  const secretKey = process.env.S3_SECRET_KEY?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const publicUrl = process.env.S3_PUBLIC_URL?.trim();

  if (!endpoint || !accessKey || !secretKey || !bucket || !publicUrl) {
    return null;
  }

  return {
    endpoint,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    accessKey,
    secretKey,
    bucket,
    publicUrl: publicUrl.replace(/\/$/, ""),
  };
}

let client: S3Client | null = null;

function getClient(config: StorageConfig): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }
  return client;
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function uploadImage(params: {
  buffer: Buffer;
  mimeType: string;
  originalFilename?: string;
}): Promise<{ key: string; url: string; mimeType: string; sizeBytes: number }> {
  const config = getStorageConfig();
  if (!config) {
    throw new Error("S3 storage is not configured");
  }

  if (params.buffer.length > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 5MB.");
  }

  const mimeType = params.mimeType.toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  const originalExt = params.originalFilename
    ? path.extname(params.originalFilename).toLowerCase()
    : "";
  if (originalExt && !ALLOWED_EXTENSIONS.has(originalExt)) {
    throw new Error(`Unsupported file extension: ${originalExt}`);
  }

  const ext = EXT_BY_MIME[mimeType] ?? originalExt ?? ".bin";

  const key = `uploads/${randomUUID()}${ext}`;
  const s3 = getClient(config);

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: params.buffer,
      ContentType: mimeType,
    }),
  );

  return {
    key,
    url: `${config.publicUrl}/${key}`,
    mimeType,
    sizeBytes: params.buffer.length,
  };
}
