import { loadEnv } from "./env.js";

/**
 * Load the repository environment before importing application modules.
 * Some modules validate their production configuration during evaluation.
 */
export async function loadConfiguredApp<T = typeof import("./app.js")>(
  importApp: () => Promise<T> = () => import("./app.js") as Promise<T>,
): Promise<T> {
  loadEnv();
  return importApp();
}
