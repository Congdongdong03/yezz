/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PartyInquiryCTA from "./PartyInquiryCTA";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      requestPackage: "Request this package",
      closeRequest: "Close request form",
      inquireContact: "Contact us",
      inquireWechat: "Copy WeChat ID",
      wechatCopied: "Copied",
    })[key] ?? key,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./PartyBookingForm", () => ({
  default: ({ party }: { party: { id: string } }) => (
    <div data-testid="party-form">{party.id}</div>
  ),
}));

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("PartyInquiryCTA", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("opens an accessible request form bound to the selected package", async () => {
    await act(async () => {
      root.render(
        <PartyInquiryCTA
          party={{
            id: "party-1",
            name: { en: "Studio Party", zh: "工作室派对" },
            minPeople: 4,
            maxPeople: 12,
            priceIndicator: "A$ test fixture",
          }}
        />,
      );
    });
    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-expanded="false"]',
    );

    expect(button?.textContent).toContain("Request this package");
    expect(container.querySelector("[data-testid='party-form']")).toBeNull();

    await act(async () => button?.click());

    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("[data-testid='party-form']")?.textContent)
      .toBe("party-1");
  });
});
