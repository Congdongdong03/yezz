import type { FastifyInstance } from "fastify";
import { success } from "../../../lib/response.js";

export default async function adminMeRoutes(app: FastifyInstance) {
  app.get("/me", async (request) => {
    const user = await app.services.auth.getMe(request.user.sub);
    return success(user);
  });

  app.post<{
    Body: { currentPassword?: unknown; newPassword?: unknown };
  }>("/me/password", async (request) => {
    const body = request.body ?? {};
    const data = await app.services.adminUsers.changePassword(
      request.user.sub,
      body.currentPassword,
      body.newPassword,
    );
    return success(data);
  });
}
