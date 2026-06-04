import type { FastifyInstance } from "fastify";
import type { SiteSettingsUpdateInput } from "../../../repositories/settings.repository.js";
import { success } from "../../../lib/response.js";

export default async function adminSettingsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.adminSettings.get();
    return success(data);
  });

  app.patch<{ Body: SiteSettingsUpdateInput }>("/", async (request) => {
    const data = await app.services.adminSettings.update(request.body);
    return success(data);
  });
}
