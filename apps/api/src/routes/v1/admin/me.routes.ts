import type { FastifyInstance } from "fastify";
import { success } from "../../../lib/response.js";

export default async function adminMeRoutes(app: FastifyInstance) {
  app.get("/me", async (request) => {
    const user = await app.services.auth.getMe(request.user.sub);
    return success(user);
  });
}
