import { createClient, type SanityClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const isSanityConfigured = Boolean(projectId);

let sanityClient: SanityClient | undefined;

function getSanityClient(): SanityClient | null {
  if (!isSanityConfigured) return null;
  sanityClient ??= createClient({
    projectId: projectId!,
    dataset,
    apiVersion: "2024-05-14",
    useCdn: false,
  });
  return sanityClient;
}

/** Lazy proxy — avoids throwing at import time when env is missing */
export const client: SanityClient = new Proxy({} as SanityClient, {
  get(_target, prop) {
    const c = getSanityClient();
    if (!c) {
      return () =>
        Promise.reject(
          new Error("Sanity is not configured (set NEXT_PUBLIC_SANITY_PROJECT_ID)"),
        );
    }
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
