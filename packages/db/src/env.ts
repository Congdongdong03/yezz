import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");

type LoadEnvOptions = {
  env?: NodeJS.ProcessEnv;
  repoRoot?: string;
};

export function loadEnv(options: LoadEnvOptions = {}): boolean {
  const env = options.env ?? process.env;
  if (env.YEZYY_CLOSURE_E2E === "1") return false;

  const root = options.repoRoot ?? repoRoot;
  const dotenvEnvironment = env as Record<string, string>;
  config({
    path: path.join(root, ".env"),
    processEnv: dotenvEnvironment,
  });
  config({
    path: path.join(root, ".env.local"),
    override: true,
    processEnv: dotenvEnvironment,
  });
  return true;
}
