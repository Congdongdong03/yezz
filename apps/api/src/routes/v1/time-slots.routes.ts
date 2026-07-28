import type { FastifyInstance } from "fastify";
import { success } from "../../lib/response.js";

export default async function timeSlotsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      year?: string;
      month?: string;
      date?: string;
      categoryId?: string;
      scope?: string;
    };
  }>("/", async (request) => {
    const { year, month, date, categoryId, scope } = request.query;
    const categoryFilter = scope === "global" ? null : categoryId;

    if (date) {
      const data = await app.services.timeSlots.getDaySlots(
        date,
        categoryFilter,
      );
      return success(data);
    }

    const y = Number.parseInt(year ?? "", 10);
    const m = Number.parseInt(month ?? "", 10);
    if (!y || !m || m < 1 || m > 12) {
      return success({ dates: [] });
    }

    const data = await app.services.timeSlots.getMonthAvailability(
      y,
      m,
      categoryFilter,
    );
    return success(data);
  });
}
