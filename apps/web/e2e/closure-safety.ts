const CLOSURE_SENTINEL_PATTERN = /^[a-f0-9]{64}$/;

function closureOrigin(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an isolated loopback origin for closure E2E`);
  }
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !/^\d+$/.test(url.port) ||
    Number(url.port) < 1 ||
    Number(url.port) > 65_535 ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be an isolated loopback origin for closure E2E`);
  }
  return url.origin;
}

export function assertClosureSafety(environment: NodeJS.ProcessEnv): {
  apiUrl: string;
  siteUrl: string;
} {
  const sentinel = environment.YEZYY_CLOSURE_RUN_SENTINEL?.trim() ?? "";
  if (!CLOSURE_SENTINEL_PATTERN.test(sentinel)) {
    throw new Error("Closure E2E requires a runner-generated sentinel");
  }
  const apiUrl = closureOrigin("API_URL", environment.API_URL?.trim() ?? "");
  const publicApiUrl = closureOrigin(
    "NEXT_PUBLIC_API_URL",
    environment.NEXT_PUBLIC_API_URL?.trim() ?? "",
  );
  const siteUrl = closureOrigin(
    "NEXT_PUBLIC_SITE_URL",
    environment.NEXT_PUBLIC_SITE_URL?.trim() ?? "",
  );
  if (apiUrl !== publicApiUrl) {
    throw new Error("API_URL and NEXT_PUBLIC_API_URL must match for closure E2E");
  }
  return { apiUrl, siteUrl };
}
