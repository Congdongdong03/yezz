import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../../lib/errors.js";
import { success } from "../../../lib/response.js";

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
    const mimeType = file.mimetype || "application/octet-stream";

    const data = await app.services.adminUpload.uploadFile({
      buffer,
      mimeType,
      filename: file.filename,
      uploadedById: request.user.sub,
    });

    return success(data);
  });
}
