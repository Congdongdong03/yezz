import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LegalPolicyPage from "./LegalPolicyPage";

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("LegalPolicyPage", () => {
  it("publishes all English booking safeguards and policy navigation", () => {
    const html = renderToStaticMarkup(
      <LegalPolicyPage locale="en" slug="booking-terms" />,
    );
    expect(html).toContain("Booking Terms");
    expect(html).toContain("request only");
    expect(html).toContain("2 hours");
    expect(html).toContain("7 calendar days");
    expect(html).toContain("20 minutes late");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/party-terms"');
  });

  it("publishes child-photo consent and privacy handling in Chinese", () => {
    const html = renderToStaticMarkup(
      <LegalPolicyPage locale="zh" slug="privacy" />,
    );
    expect(html).toContain("隐私政策");
    expect(html).toContain("儿童照片");
    expect(html).toContain("家长或法定监护人授权");
    expect(html).toContain("不会出售个人信息");
  });

  it("keeps Australian Consumer Law protection in party terms", () => {
    const html = renderToStaticMarkup(
      <LegalPolicyPage locale="en" slug="party-terms" />,
    );
    expect(html).toContain("A$95 or A$145");
    expect(html).toContain("4–8 DIY participants");
    expect(html).toContain("cannot lawfully be excluded");
  });
});
