import { describe, expect, it } from "vitest";
import enMessages from "@/lib/i18n/messages/en.json";
import zhMessages from "@/lib/i18n/messages/zh.json";
import { buildPageMetadata } from "./metadata";

describe("buildPageMetadata", () => {
  it("uses canonical profile metadata when settings have no SEO overrides", async () => {
    const originalUseApi = process.env.NEXT_PUBLIC_USE_API;
    process.env.NEXT_PUBLIC_USE_API = "false";

    try {
      const metadata = await buildPageMetadata({
        locale: "en",
        pathname: "/projects/beading",
      });

      expect(metadata.title).toBe("YezYY");
      expect(metadata.description).toBe(
        "YezYY — G082/235 Springvale Rd, Glen Waverley VIC 3150",
      );
      expect(metadata.alternates).toEqual({
        canonical: "/en/projects/beading",
        languages: {
          en: "/en/projects/beading",
          "zh-CN": "/zh/projects/beading",
        },
      });
    } finally {
      if (originalUseApi === undefined) {
        delete process.env.NEXT_PUBLIC_USE_API;
      } else {
        process.env.NEXT_PUBLIC_USE_API = originalUseApi;
      }
    }
  });

  it.each([
    [
      "English",
      enMessages.metadata,
      "YezYY - DIY Studio",
      "Create your own masterpiece at YezYY DIY Studio",
    ],
    [
      "Chinese",
      zhMessages.metadata,
      "YezYY - 手作体验馆",
      "在 YezYY 手作体验馆，亲手制作独一无二的作品",
    ],
  ])(
    "uses the canonical brand in %s route-supplied metadata",
    async (_locale, routeMetadata, expectedTitle, expectedDescription) => {
      const originalUseApi = process.env.NEXT_PUBLIC_USE_API;
      process.env.NEXT_PUBLIC_USE_API = "false";

      try {
        const metadata = await buildPageMetadata({
          description: routeMetadata.description,
        });

        expect(routeMetadata.title).toBe(expectedTitle);
        expect(metadata.description).toBe(expectedDescription);
      } finally {
        if (originalUseApi === undefined) {
          delete process.env.NEXT_PUBLIC_USE_API;
        } else {
          process.env.NEXT_PUBLIC_USE_API = originalUseApi;
        }
      }
    },
  );
});
