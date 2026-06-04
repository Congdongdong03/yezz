import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function loadEnv() {
  config({ path: path.join(repoRoot, ".env") });
  config({ path: path.join(repoRoot, ".env.local"), override: true });
}
