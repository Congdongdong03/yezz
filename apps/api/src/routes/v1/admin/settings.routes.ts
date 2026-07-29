import type { FastifyInstance } from "fastify";
import type { SiteSettingsUpdateInput } from "../../../repositories/settings.repository.js";
import { success } from "../../../lib/response.js";

export default async function adminSettingsRoutes(app: FastifyInstance) {
  type WeeklyDay = {
    weekday: number;
    opensAt: string;
    closesAt: string;
    isClosed: boolean;
  };
  type WeeklyHoursBody = {
    days: WeeklyDay[];
    acknowledgement?: { fingerprint: string };
  };
  type SpecialHoursBody = {
    date: string;
    opensAt?: string | null;
    closesAt?: string | null;
    isClosed: boolean;
    note?: string | null;
    acknowledgement?: { fingerprint: string };
  };
  type ClosureBody = {
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    note?: string | null;
    acknowledgement?: { fingerprint: string };
  };

  app.get("/", async () => {
    const data = await app.services.adminSettings.get();
    return success(data);
  });

  app.patch<{ Body: SiteSettingsUpdateInput }>("/", async (request) => {
    const data = await app.services.adminSettings.update(request.body);
    return success(data);
  });

  app.get("/schedule", async () => {
    return success(await app.services.adminSettings.getSchedule());
  });

  app.put<{ Body: WeeklyHoursBody }>(
    "/schedule/weekly",
    async (request) => {
      return success(
        await app.services.adminSettings.updateWeekly(request.body),
      );
    },
  );

  app.post<{ Body: SpecialHoursBody }>(
    "/schedule/special-hours",
    async (request) => {
      return success(
        await app.services.adminSettings.upsertSpecialHours(request.body),
      );
    },
  );

  app.post<{ Body: ClosureBody }>(
    "/schedule/closures",
    async (request) => {
      return success(
        await app.services.adminSettings.createClosure(request.body),
      );
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/schedule/closures/:id",
    async (request) => {
      return success(
        await app.services.adminSettings.deleteClosure(request.params.id),
      );
    },
  );

  app.patch<{
    Body: {
      experience?: boolean;
      party?: boolean;
      product?: boolean;
    };
  }>("/request-switches", async (request) => {
    return success(
      await app.services.adminSettings.updateRequestSwitches(request.body),
    );
  });
}
