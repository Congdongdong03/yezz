import type { FastifyInstance } from "fastify";
import { success } from "../../../lib/response.js";

export default async function adminUsersRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.adminUsers.list();
    return success(data);
  });

  app.post<{ Body: { email?: string; name?: string; role?: string; password?: string } }>(
    "/",
    async (request) => {
      const body = request.body ?? {};
      const data = await app.services.adminUsers.create({
        email: String(body.email ?? ""),
        name: String(body.name ?? ""),
        role: (body.role === "admin" ? "admin" : "staff") as "admin" | "staff",
        password: body.password,
      });
      return success(data);
    },
  );

  app.patch<{ Params: { id: string }; Body: { email?: string; name?: string; role?: string } }>(
    "/:id",
    async (request) => {
      const body = request.body ?? {};
      const data = await app.services.adminUsers.update(request.params.id, {
        email: body.email ? String(body.email) : undefined,
        name: body.name ? String(body.name) : undefined,
        role: body.role === "admin" || body.role === "staff" ? body.role : undefined,
      });
      return success(data);
    },
  );

  app.post<{ Params: { id: string } }>("/:id/reset-password", async (request) => {
    const data = await app.services.adminUsers.resetPassword(request.params.id);
    return success(data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminUsers.remove(
      request.params.id,
      request.user.sub,
    );
    return success(data);
  });
}
