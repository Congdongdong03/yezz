import type { FastifyInstance } from "fastify";
import { AppError, isAppError } from "../lib/errors.js";
import { apiError } from "../lib/response.js";
import { captureApiException } from "../lib/monitoring.js";

function isInvalidJsonBody(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "FST_ERR_CTP_INVALID_JSON_BODY"
  );
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      return reply
        .status(error.statusCode)
        .send(apiError(error.code, error.message, error.details));
    }

    if (isInvalidJsonBody(error)) {
      return reply
        .status(400)
        .send(apiError("VALIDATION_ERROR", "Request body must be valid JSON"));
    }

    captureApiException(error, request);
    app.log.error(error);
    return reply
      .status(500)
      .send(apiError("INTERNAL_ERROR", "An unexpected error occurred"));
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send(apiError("NOT_FOUND", "Route not found"));
  });
}
