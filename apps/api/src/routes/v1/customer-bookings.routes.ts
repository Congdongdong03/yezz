import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../lib/errors.js";
import {
  enforceRequestLimit,
  resolvePublicRateLimitSubject,
} from "../../lib/public-request-limit.js";
import { success } from "../../lib/response.js";

const CUSTOMER_ACTION_RATE_LIMIT = 12;
const CUSTOMER_ACTION_RATE_WINDOW_SECONDS = 3600;

function tokenDigestPrefix(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

function assertToken(token: string): void {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new AppError(404, "LINK_INVALID_OR_EXPIRED", "This link is invalid or expired");
  }
}

function parseRescheduleBody(body: unknown): { date: string; startTime: string } {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "date" && key !== "startTime")
  ) {
    throw new AppError(400, "VALIDATION_ERROR", "date and startTime are required");
  }
  const input = body as { date?: unknown; startTime?: unknown };
  if (
    typeof input.date !== "string" ||
    typeof input.startTime !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)
  ) {
    throw new AppError(400, "VALIDATION_ERROR", "date and startTime are required");
  }
  return { date: input.date, startTime: input.startTime };
}

export default async function customerBookingsRoutes(app: FastifyInstance) {
  async function enforceCustomerActionLimit(
    request: { params: { token: string }; verifiedClientIdentity: unknown; ip: string },
    reply: Parameters<typeof enforceRequestLimit>[5],
  ) {
    const subject = `${resolvePublicRateLimitSubject(request as never)}:${tokenDigestPrefix(request.params.token)}`;
    await enforceRequestLimit(
      app.services.rateLimits,
      "customer-booking-action",
      subject,
      CUSTOMER_ACTION_RATE_LIMIT,
      CUSTOMER_ACTION_RATE_WINDOW_SECONDS,
      reply,
    );
    assertToken(request.params.token);
  }

  app.get<{ Params: { token: string } }>("/:token", async (request, reply) => {
    await enforceCustomerActionLimit(request, reply);
    return success(await app.services.customerActions.resolve(request.params.token));
  });

  app.post<{ Params: { token: string } }>("/:token/request-cancellation", async (request, reply) => {
    await enforceCustomerActionLimit(request, reply);
    return success(await app.services.customerActions.requestCancellation(request.params.token));
  });

  app.post<{ Params: { token: string } }>("/:token/accept-time", async (request, reply) => {
    await enforceCustomerActionLimit(request, reply);
    return success(await app.services.partyCustomerActions.acceptPartyTimeByToken(request.params.token));
  });

  app.post<{ Params: { token: string }; Body: unknown }>("/:token/request-reschedule", async (request, reply) => {
    await enforceCustomerActionLimit(request, reply);
    return success(await app.services.customerActions.requestReschedule(
      request.params.token,
      parseRescheduleBody(request.body),
    ));
  });
}
