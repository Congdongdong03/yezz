import { describe, expect, it } from "vitest";
import { buildPageMetadata } from "./metadata";

describe("buildPageMetadata", () => {
  it("uses canonical profile metadata when settings have no SEO overrides", async () => {
    const originalUseApi = process.env.NEXT_PUBLIC_USE_API;
    process.env.NEXT_PUBLIC_USE_API = "false";

    try {
      const metadata = await buildPageMetadata();

      expect(metadata.title).toBe("YezYY");
      expect(metadata.description).toBe(
        "YezYY — G082/235 Springvale Rd, Glen Waverley VIC 3150",
      );
    } finally {
      if (originalUseApi === undefined) {
        delete process.env.NEXT_PUBLIC_USE_API;
      } else {
        process.env.NEXT_PUBLIC_USE_API = originalUseApi;
      }
    }
  });
});
