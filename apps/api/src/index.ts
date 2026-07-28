import { loadConfiguredApp } from "./startup.js";

const { buildApp } = await loadConfiguredApp();

const port = Number(process.env.PORT) || 4000;

const app = await buildApp();

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
