import { describe, expect, it } from "vitest";
import { DEFAULT_YEZYY_SITE_SETTINGS } from "./settings.admin.service.js";

describe("admin settings defaults", () => {
  it("uses the approved YezYY contact email when creating settings", () => {
    expect(DEFAULT_YEZYY_SITE_SETTINGS.email).toBe("congdongdong03@gmail.com");
  });
});
