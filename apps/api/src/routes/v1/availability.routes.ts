import type { FastifyInstance } from "fastify";
import { AppError } from "../../lib/errors.js";
import { success } from "../../lib/response.js";

function queryInteger(value: string | undefined, name: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${name} must be an integer`);
  }
  return Number(value);
}

function queryDate(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "date must use YYYY-MM-DD");
  }
  return value;
}

export default async function availabilityRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      date?: string;
      durationMinutes?: string;
      attendance?: string;
    };
  }>("/ordinary", async (request) => {
    const durationMinutes = queryInteger(
      request.query.durationMinutes,
      "durationMinutes",
    );
    if (durationMinutes !== 30 && durationMinutes !== 60) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "durationMinutes must be 30 or 60",
      );
    }
    const data = await app.services.availability.listOrdinary({
      date: queryDate(request.query.date),
      durationMinutes,
      attendance: queryInteger(request.query.attendance, "attendance"),
    });
    return success(data);
  });

  app.get<{
    Querystring: { date?: string; guestDurationMinutes?: string };
  }>("/party", async (request) => {
    const guestDurationMinutes = queryInteger(
      request.query.guestDurationMinutes,
      "guestDurationMinutes",
    );
    if (![30, 60, 90, 150].includes(guestDurationMinutes)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "guestDurationMinutes is not supported",
      );
    }
    const data = await app.services.availability.listPartyCandidates({
      date: queryDate(request.query.date),
      guestDurationMinutes: guestDurationMinutes as 30 | 60 | 90 | 150,
    });
    return success(data);
  });
}
