import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export default fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "YEZZ API",
        description: "REST API for YEZZ studio website and admin",
        version: "1.0.0",
      },
      servers: [{ url: "/api/v1", description: "API v1" }],
      tags: [
        { name: "public", description: "Public endpoints" },
        { name: "auth", description: "Authentication" },
        { name: "admin", description: "Admin (JWT required)" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    staticCSP: true,
  });
});
