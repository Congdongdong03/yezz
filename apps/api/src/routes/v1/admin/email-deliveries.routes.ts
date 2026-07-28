import type { FastifyInstance } from "fastify";
import { AppError } from "../../../lib/errors.js";
import { success } from "../../../lib/response.js";
import type { EmailDeliveryStatus } from "../../../repositories/email-outbox.repository.js";

const VALID_STATUSES = new Set<EmailDeliveryStatus>([
  "pending",
  "processing",
  "sent",
  "failed",
]);

export function parseEmailDeliveryPagination(
  value: string | undefined,
  fallback: number,
  max?: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "pagination values must be positive integers",
    );
  }
  return max === undefined ? parsed : Math.min(parsed, max);
}

export default async function adminEmailDeliveriesRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { page?: string; limit?: string; status?: string };
  }>("/", async (request) => {
    const status = request.query.status;
    if (status && !VALID_STATUSES.has(status as EmailDeliveryStatus)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "status must be pending, processing, sent, or failed",
      );
    }
    const data = await app.services.emailOutbox.list({
      page: parseEmailDeliveryPagination(request.query.page, 1),
      limit: parseEmailDeliveryPagination(request.query.limit, 25, 100),
      status: status as EmailDeliveryStatus | undefined,
    });
    return success(data);
  });

  app.post<{ Params: { id: string } }>("/:id/retry", async (request) => {
    const data = await app.services.emailOutbox.retry(request.params.id);
    return success(data);
  });
}
