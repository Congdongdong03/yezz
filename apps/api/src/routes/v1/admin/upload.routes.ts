import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../../../lib/errors.js";
import { success } from "../../../lib/response.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export default async function adminUploadRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
  });

  app.post("/", async (request) => {
    const file = await request.file();
    if (!file) {
      throw new AppError(400, "VALIDATION_ERROR", "No file uploaded");
    }

    const buffer = await file.toBuffer();

    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid file type. Only JPEG, PNG, WebP and GIF images are allowed.",
      );
    }

    const data = await app.services.adminUpload.uploadFile({
      buffer,
      mimeType: detected.mime,
      filename: file.filename,
      uploadedById: request.user.sub,
    });

    return success(data);
  });
}
