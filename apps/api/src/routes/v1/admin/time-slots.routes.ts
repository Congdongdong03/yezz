import type { FastifyInstance } from "fastify";
import { success } from "../../../lib/response.js";
import { parsePositiveInt } from "../../../lib/validation.js";
import type { TimeSlotUpdateInput } from "../../../repositories/time-slots.repository.js";

export default async function adminTimeSlotsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.timeSlots.listAdmin();
    return success(data);
  });

  app.post<{ Body: Record<string, unknown> }>("/", async (request) => {
    const body = request.body ?? {};
    if (body.startDate && body.endDate) {
      const data = await app.services.timeSlots.createBatch({
        startDate: String(body.startDate),
        endDate: String(body.endDate),
        weekdays: Array.isArray(body.weekdays)
          ? body.weekdays.map((d) => Number(d)).filter((n) => !Number.isNaN(n))
          : [],
        slots: Array.isArray(body.slots)
          ? (body.slots as Array<{ startTime: string; endTime: string; capacity: number }>)
          : [],
        categoryId: body.categoryId ? String(body.categoryId) : null,
        notes: body.notes ? String(body.notes) : null,
      });
      return success(data);
    }

    const data = await app.services.timeSlots.create({
      date: String(body.date ?? ""),
      startTime: String(body.startTime ?? ""),
      endTime: String(body.endTime ?? ""),
      capacity: parsePositiveInt(body.capacity, 0),
      categoryId: body.categoryId ? String(body.categoryId) : null,
      notes: body.notes ? String(body.notes) : null,
    });
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: TimeSlotUpdateInput }>(
    "/:id",
    async (request) => {
      const data = await app.services.timeSlots.update(request.params.id, request.body ?? {});
      return success(data);
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.timeSlots.remove(request.params.id);
    return success(data);
  });
}
