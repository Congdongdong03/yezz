import type { FastifyInstance } from "fastify";
import { success } from "../../lib/response.js";

type LoginBody = {
  email?: string;
  password?: string;
};

export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: LoginBody }>("/login", async (request) => {
    const { email = "", password = "" } = request.body ?? {};
    const result = await app.services.auth.login(email, password, (payload) =>
      request.server.jwt.sign(payload),
    );
    return success(result);
  });
}
