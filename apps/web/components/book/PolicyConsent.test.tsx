import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PolicyConsent from "./PolicyConsent";

describe("PolicyConsent", () => {
  it("summarises the three booking-critical rules without repeating store contact details", () => {
    const html = renderToStaticMarkup(
      <PolicyConsent
        checked={false}
        locale="en"
        onChange={vi.fn()}
      />,
    );

    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain("not confirmed until YezYY staff confirms it");
    expect(html).toContain("Payment is in store");
    expect(html).toContain("more than 20 minutes late");
    expect(html).not.toContain("G082/235 Springvale Rd");
    expect(html).not.toContain("0430787712");
  });

  it("keeps the three complete policy links and acceptance control", () => {
    const html = renderToStaticMarkup(
      <PolicyConsent checked locale="zh" onChange={vi.fn()} />,
    );

    expect(html).toContain('href="/zh/booking-terms"');
    expect(html).toContain('href="/zh/cancellation-rescheduling"');
    expect(html).toContain('href="/zh/privacy"');
    expect(html).toContain('name="policyAccepted"');
  });
});
