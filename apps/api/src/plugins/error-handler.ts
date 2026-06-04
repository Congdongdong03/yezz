import type { FastifyInstance } from "fastify";
import { AppError, isAppError } from "../lib/errors.js";
import { apiError } from "../lib/response.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send(apiError(error.code, error.message));
    }

    app.log.error(error);
    return reply.status(500).send(apiError("INTERNAL_ERROR", "An unexpected error occurred"));
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send(apiError("NOT_FOUND", "Route not found"));
  });
}
