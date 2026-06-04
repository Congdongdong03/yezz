import { describe, expect, it } from "vitest";
import { displayLocalized, escapeHtml } from "./email.js";

describe("email helpers", () => {
  it("escapes HTML in user content", () => {
    expect(escapeHtml(`<script>"x"</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot;&lt;/script&gt;",
    );
  });

  it("displays localized strings with en/zh fallback", () => {
    expect(displayLocalized({ en: "Phone Case", zh: "手机壳" })).toBe("Phone Case");
    expect(displayLocalized({ zh: "手机壳" })).toBe("手机壳");
    expect(displayLocalized("plain")).toBe("plain");
    expect(displayLocalized(null)).toBe("N/A");
  });
});
