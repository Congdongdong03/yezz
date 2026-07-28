/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CartPage from "./page";

const { fetchSiteSettingsMock } = vi.hoisted(() => ({
  fetchSiteSettingsMock: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  fetchSiteSettings: fetchSiteSettingsMock,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/cart/context", () => ({
  useCart: () => ({
    items: [
      {
        projectId: "product-1",
        projectName: { en: "Phone Case", zh: "手机壳" },
        people: 1,
      },
    ],
    clearItems: vi.fn(),
    removeItem: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/components/book/BookingCalendar", () => ({
  default: () => <div data-testid="calendar" />,
}));

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("cart request capability", () => {
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
    vi.clearAllMocks();
  });

  it.each([
    ["absent", undefined],
    ["malformed", { product: "true" }],
  ])(
    "keeps the contact fallback for %s rollout capability data",
    async (_description, requestCapabilities) => {
      fetchSiteSettingsMock.mockResolvedValue({ requestCapabilities });

      await act(async () => {
        root.render(<CartPage />);
      });

      expect(
        container.querySelector("[data-testid='request-contact-fallback']"),
      ).not.toBeNull();
      expect(container.querySelector("form")).toBeNull();
    },
  );
});
