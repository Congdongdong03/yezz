import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./url";

describe("getSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the canonical public origin instead of a deployment preview fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "yezyy-preview.vercel.app");

    expect(getSiteUrl()).toBe("https://yezyy.com");
  });
});
