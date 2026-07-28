import type { FastifyInstance } from "fastify";
import { AppError } from "../../../lib/errors.js";
import { success } from "../../../lib/response.js";
import { parsePositiveInt } from "../../../lib/validation.js";
import type { EmailDeliveryStatus } from "../../../repositories/email-outbox.repository.js";

const VALID_STATUSES = new Set<EmailDeliveryStatus>([
  "pending",
  "processing",
  "sent",
  "failed",
]);

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
      page: request.query.page
        ? parsePositiveInt(request.query.page, 1)
        : undefined,
      limit: request.query.limit
        ? parsePositiveInt(request.query.limit, 25, 100)
        : undefined,
      status: status as EmailDeliveryStatus | undefined,
    });
    return success(data);
  });

  app.post<{ Params: { id: string } }>("/:id/retry", async (request) => {
    const data = await app.services.emailOutbox.retry(request.params.id);
    return success(data);
  });
}
