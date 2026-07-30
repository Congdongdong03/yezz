import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import StudioConfidenceStrip from "./StudioConfidenceStrip";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      beginner: "Beginner friendly",
      included: "Materials included",
      confirmation: "Manually confirmed",
      payment: "Pay in store",
    })[key] ?? key,
}));

describe("StudioConfidenceStrip", () => {
  it("renders four compact operational facts", () => {
    const html = renderToStaticMarkup(<StudioConfidenceStrip />);

    expect(html).toContain("<ul");
    expect(html).toContain("Beginner friendly");
    expect(html).toContain("Materials included");
    expect(html).toContain("Manually confirmed");
    expect(html).toContain("Pay in store");
  });
});
