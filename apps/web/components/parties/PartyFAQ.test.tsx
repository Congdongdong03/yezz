import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PartyFAQ from "./PartyFAQ";

describe("PartyFAQ", () => {
  it("answers the operational questions customers ask before a party", () => {
    const html = renderToStaticMarkup(<PartyFAQ locale="en" />);

    expect(html).toContain("Is my requested time confirmed immediately?");
    expect(html).toContain("4–8 DIY participants");
    expect(html).toContain("at least 5 years old");
    expect(html).toContain("1–2 accompanying parents");
    expect(html).toContain("A$45 minimum DIY spend");
    expect(html).toContain("cake, drinks, food, and snacks");
    expect(html).toContain("separate visit before the party date");
    expect(html).toContain("staff will tell you the payment deadline");
    expect(html).toContain("There is no online payment");
  });

  it("provides the same rules in Chinese", () => {
    const html = renderToStaticMarkup(<PartyFAQ locale="zh" />);

    expect(html).toContain("4 至 8 位手作参与者");
    expect(html).toContain("至少 5 岁");
    expect(html).toContain("1 至 2 位陪同家长");
    expect(html).toContain("派对日期前另行到店");
    expect(html).toContain("由店员告知付款期限");
  });
});
