import type { FastifyInstance } from "fastify";
import { success } from "../../lib/response.js";

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.settings.get();
    return success(data);
  });
}
