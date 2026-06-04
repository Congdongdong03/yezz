import { createDb, type Db } from "@yezz/db";
import fp from "fastify-plugin";

type DbConnection = ReturnType<typeof createDb>;

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    sql: DbConnection["client"];
  }
}

export default fp(async (app) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const { db, client } = createDb(databaseUrl);
  app.decorate("db", db);
  app.decorate("sql", client);

  app.addHook("onClose", async () => {
    await client.end();
  });
});
