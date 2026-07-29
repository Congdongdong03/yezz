/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/base";
import ManageBookingPage, { metadata } from "./page";

const TOKEN = "A".repeat(43);
const api = vi.hoisted(() => ({
  getCustomerBooking: vi.fn(),
  acceptProposedTime: vi.fn(),
  requestCustomerCancellation: vi.fn(),
  requestCustomerReschedule: vi.fn(),
}));
const request = vi.hoisted(() => ({
  headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.4" }),
}));

vi.mock("@/lib/api/customer-booking", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/api/customer-booking")>();
  return { ...original, ...api };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en", token: TOKEN }),
}));

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale }: { locale: string }) => {
    const messages: Record<string, Record<string, string>> = {
      en: {
        eyebrow: "Secure customer booking link",
        title: "Manage your YezYY request",
        intro:
          "Only the actions available for this booking are shown below.",
        invalidTitle: "This booking link is not available",
        invalidBody:
          "The link may be invalid, expired, or no longer available. Contact YezYY for help.",
      },
      zh: {
        eyebrow: "安全预约链接",
        title: "管理你的 YezYY 申请",
        intro: "下方仅显示本次预约当前可执行的操作。",
        invalidTitle: "此预约链接不可用",
        invalidBody:
          "链接可能无效、已过期或当前不可用。如需协助，请联系 YezYY。",
      },
    };
    return (key: string) => messages[locale]?.[key] ?? key;
  },
}));

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("ManageBookingPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubEnv("VERCEL", "1");
    request.headers = new Headers({ "x-vercel-forwarded-for": "203.0.113.4" });
    api.getCustomerBooking.mockReset().mockResolvedValue({
      kind: "experience",
      status: "confirmed",
      locale: "en",
      offeringLabel: "Cream piping DIY",
      date: "2030-08-12",
      startTime: "10:00",
      endTime: "11:00",
      allowedActions: ["request_cancellation"],
      id: "internal-booking-id",
      tokenDigest: "digest-must-not-render",
      internalNotes: "private staff note",
      auditActor: "staff@example.com",
    });
    api.requestCustomerCancellation.mockReset().mockResolvedValue({
      status: "cancellation_requested",
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderPage(locale = "en") {
    const page = await ManageBookingPage({
      params: Promise.resolve({ locale, token: TOKEN }),
    });
    await act(async () => root.render(page));
  }

  it("loads by path token, uses the booking locale, and renders only the safe view", async () => {
    api.getCustomerBooking.mockResolvedValueOnce({
      kind: "experience",
      status: "confirmed",
      locale: "zh",
      offeringLabel: "奶油胶手作",
      date: "2030-08-12",
      startTime: "10:00",
      endTime: "11:00",
      allowedActions: ["request_cancellation"],
      id: "internal-booking-id",
      tokenDigest: "digest-must-not-render",
      internalNotes: "private staff note",
      auditActor: "staff@example.com",
    });
    await renderPage("en");

    expect(api.getCustomerBooking).toHaveBeenCalledWith(
      TOKEN,
      "203.0.113.4",
    );
    expect(container.textContent).toContain("管理你的 YezYY 申请");
    expect(container.textContent).toContain("奶油胶手作");
    expect(container.textContent).toContain("申请取消");
    for (const secret of [
      TOKEN,
      "internal-booking-id",
      "digest-must-not-render",
      "private staff note",
      "staff@example.com",
    ]) {
      expect(container.innerHTML).not.toContain(secret);
    }
  });

  it.each([
    ["invalid", 404, "LINK_INVALID_OR_EXPIRED"],
    ["expired", 404, "LINK_INVALID_OR_EXPIRED"],
    ["wrong scope", 403, "CUSTOMER_ACTION_FORBIDDEN"],
    ["wrong state", 409, "STATUS_CONFLICT"],
  ])("gives %s links the same generic surface", async (_name, status, code) => {
    api.getCustomerBooking.mockRejectedValue(
      new ApiClientError("Private upstream detail", code, status),
    );
    await renderPage();

    expect(container.textContent).toContain(
      "This booking link is not available",
    );
    expect(container.textContent).toContain(
      "invalid, expired, or no longer available",
    );
    expect(container.textContent).not.toContain("Private upstream detail");
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("declares noindex, nofollow, and no-referrer metadata", () => {
    expect(metadata).toEqual({
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    });
  });

  it("never turns a generic forwarded header into a trusted Vercel identity", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    request.headers = new Headers({ "x-forwarded-for": "198.51.100.77" });

    await renderPage();

    expect(api.getCustomerBooking).not.toHaveBeenCalled();
    expect(container.textContent).toContain("This booking link is not available");
  });
});
