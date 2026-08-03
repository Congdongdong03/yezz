/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PartiesPage from "./page";

const state = vi.hoisted(() => ({
  locale: "en",
  requestEnabled: false,
  partiesOk: true,
  partyImage: false,
}));

const english: Record<string, string> = {
  title: "Celebrate at YezYY",
  subtitle:
    "A guided DIY party in Glen Waverley, planned with a real person from our studio.",
  eyebrow: "Private DIY celebrations",
  standardName: "Standard",
  extendedName: "Extended",
  guestUse: "guest use",
  setupCleanup: "30-minute setup and 30-minute cleanup handled by staff",
  attendance: "4–8 DIY participants + 1–2 accompanying parents",
  minimumSpend: "A$45 minimum DIY spend per participant",
  includedTitle: "Made for a creative birthday",
  includedDecorations: "Birthday setup and decorations",
  includedGift:
    "A surprise gift for the birthday child, selected by staff from a plush toy, Lego set, or toy",
  includedVoucher:
    "15% in-store voucher, excluding Pop Mart, venue fees, and booking-related charges",
  byoTitle: "Bring the celebration",
  byoBody: "Bring cake, drinks, food, and snacks.",
  cakeCutting: "Staff cake cutting: A$15",
  cleaning: "Cleaning when applicable: A$15–A$35",
  overtime: "15–30 minutes overtime when applicable: A$15–A$35",
  paymentTitle: "Request first. Pay in store after confirmation.",
  paymentBody:
    "The venue fee is also the deposit. Pay it in store during a separate visit before the party date. After confirmation, staff will tell you the payment deadline. There is no online payment.",
  refund:
    "Cancel at least 48 hours before the final guest start for a full venue-fee refund. Later cancellation is non-refundable.",
  timeRequest:
    "Your preferred time is a request only. Staff may confirm it or propose another time.",
  contactTitle: "Plan your party with YezYY",
};

const chinese: Record<string, string> = {
  ...english,
  title: "在 YezYY 庆祝",
  subtitle: "在 Glen Waverley 举办由店员协助规划的手作派对。",
  attendance: "4 至 8 位手作参与者 + 1 至 2 位陪同家长",
  minimumSpend: "每位参与者手作项目最低消费 45 澳元",
  includedDecorations: "生日布置与装饰",
  includedGift:
    "为生日小朋友准备一份惊喜礼物，由员工从毛绒玩具、乐高套装或玩具中选择",
  includedVoucher:
    "一张店内 85 折优惠券，不适用于 Pop Mart、场地费及预约相关费用",
  byoBody: "可自带蛋糕、饮料、食物和零食。",
  cakeCutting: "员工切蛋糕服务：15 澳元",
  cleaning: "如适用，清洁费：15–35 澳元",
  overtime: "如适用，超时 15–30 分钟：15–35 澳元",
  paymentTitle: "先提交申请，确认后到店付款。",
  paymentBody: "场地费同时作为订金，需在派对日期前另行到店支付。确认后由店员告知付款期限。网站不提供线上付款。",
  refund:
    "至少在最终派对开始前 48 小时取消，可全额退还场地费；不足 48 小时不退款。",
  timeRequest: "首选时段仅为申请；员工可能确认该时段或提出其他时段。",
  contactTitle: "与 YezYY 一起规划派对",
};

function translate(locale: string, key: string, values?: Record<string, unknown>) {
  const value = (locale === "zh" ? chinese : english)[key] ?? key;
  return Object.entries(values ?? {}).reduce(
    (text, [name, replacement]) =>
      text.replace(`{${name}}`, String(replacement)),
    value,
  );
}

vi.mock("next-intl/server", () => ({
  getTranslations: async ({
    locale,
  }: {
    locale?: string;
    namespace?: string;
  }) => {
    const resolved = locale ?? state.locale;
    return (key: string, values?: Record<string, unknown>) =>
      translate(resolved, key, values);
  },
}));

vi.mock("next-intl", () => ({
  useLocale: () => state.locale,
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    translate(state.locale, key, values),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
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

vi.mock("@/lib/site/metadata", () => ({
  buildPageMetadata: vi.fn(async (value) => value),
}));

vi.mock("@/lib/site/data", () => ({
  loadSiteSettings: vi.fn(async () => ({
    requestCapabilities: { party: state.requestEnabled },
  })),
  loadPartiesPageData: vi.fn(async () =>
    state.partiesOk
      ? {
          ok: true,
          data: [
            {
              _id: "00000000-0000-4000-8000-000000000003",
              slug: { current: "party-90" },
              name: {
                en: "90-minute party package",
                zh: "90分钟派对套餐",
              },
              description: undefined,
              includes: [],
              imageUrl: undefined,
              images: [],
              minPeople: 4,
              maxPeople: 8,
              priceIndicator: undefined,
              guestDurationMinutes: 90,
              setupMinutes: 30,
              cleanupMinutes: 30,
              venueFeeCents: 9500,
              minSpendPerPersonCents: 4500,
              minParents: 1,
              maxParents: 2,
              tags: undefined,
            },
            {
              _id: "00000000-0000-4000-8000-000000000004",
              slug: { current: "party-150" },
              name: {
                en: "150-minute party package",
                zh: "150分钟派对套餐",
              },
              description: undefined,
              includes: [],
              imageUrl: undefined,
              images: [],
              minPeople: 4,
              maxPeople: 8,
              priceIndicator: undefined,
              guestDurationMinutes: 150,
              setupMinutes: 30,
              cleanupMinutes: 30,
              venueFeeCents: 14500,
              minSpendPerPersonCents: 4500,
              minParents: 1,
              maxParents: 2,
              tags: undefined,
            },
          ],
        }
      : { ok: false },
  ),
  loadGalleryPageData: vi.fn(async () => ({
    ok: true,
    data: state.partyImage
      ? [
          {
            _id: "party-photo",
            imageUrl: "/party.jpg",
            category: "party",
            caption: { en: "YezYY party table", zh: "YezYY 派对桌面" },
            order: 0,
          },
        ]
      : [],
  })),
}));

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("PartiesPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.locale = "en";
    state.requestEnabled = false;
    state.partiesOk = true;
    state.partyImage = false;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderPage(locale: "en" | "zh" = "en") {
    state.locale = locale;
    const page = await PartiesPage({
      params: Promise.resolve({ locale }),
    });
    await act(async () => root.render(page));
  }

  it("keeps the capability-off page useful, truthful, and non-submittable", async () => {
    await renderPage();

    expect(container.textContent).toContain("A$95");
    expect(container.textContent).toContain("1.5");
    expect(container.textContent).toContain("A$45 minimum DIY spend");
    expect(container.textContent).toContain("1–2 accompanying parents");
    expect(container.textContent).toContain("Birthday setup and decorations");
    expect(container.textContent).toContain("A$15–A$35");
    expect(container.textContent).toContain("There is no online payment");
    expect(container.textContent).toContain("separate visit before the party date");
    expect(container.textContent).toContain("staff will tell you the payment deadline");
    expect(container.textContent).toContain("at least 48 hours");
    expect(container.textContent).toContain("non-refundable");
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('a[href="tel:0430787712"]')).not.toBeNull();
    expect(
      container.querySelector(
        'a[href="mailto:congdongdong03@gmail.com"]',
      ),
    ).not.toBeNull();
  });

  it("explains confirmation and payment once instead of repeating it across package cards", async () => {
    await renderPage();

    expect(
      container.textContent?.match(
        /The venue fee is also the deposit\. Pay it in store during a separate visit before the party date\./g,
      ),
    ).toHaveLength(1);
    expect(
      container.textContent?.match(
        /Request first\. Pay in store after confirmation\./g,
      ),
    ).toHaveLength(1);
    const packageCards = Array.from(container.querySelectorAll("article")).filter(
      (article) =>
        article.textContent?.includes("guest use") &&
        (article.textContent.includes("A$95") ||
          article.textContent.includes("A$145")),
    );
    expect(packageCards).toHaveLength(2);
    for (const card of packageCards) {
      expect(card.textContent).not.toContain(
        "Your preferred time is a request only",
      );
    }
    expect(container.textContent).toContain("Made for a creative birthday");
    expect(container.textContent).toContain("Bring the celebration");
  });

  it("uses a verified party image without changing the request gate", async () => {
    state.partyImage = true;
    await renderPage();

    expect(container.querySelector('img[alt="YezYY party table"]')).not.toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });

  it("opens the complete request form only when the effective party gate is true", async () => {
    state.requestEnabled = true;
    await renderPage();

    const opener = container.querySelector<HTMLButtonElement>(
      'button[aria-expanded="false"]',
    );
    expect(opener).not.toBeNull();
    await act(async () => opener?.click());

    expect(
      container.querySelector<HTMLInputElement>('[name="participantCount"]'),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLInputElement>('[name="birthdayChildName"]'),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLInputElement>('[name="policyAccepted"]'),
    ).not.toBeNull();
  });

  it("renders the exact Simplified Chinese payment and refund policy", async () => {
    await renderPage("zh");

    expect(container.textContent).toContain("网站不提供线上付款");
    expect(container.textContent).toContain("开始前 48 小时");
    expect(container.textContent).toContain("不足 48 小时不退款");
    expect(container.textContent).toContain("每位参与者手作项目最低消费 45 澳元");
  });

  it("uses the approved package facts even when the catalogue is unavailable", async () => {
    state.partiesOk = false;
    await renderPage();

    expect(container.textContent).toContain("A$95");
    expect(container.textContent).toContain("A$145");
    expect(container.querySelector("form")).toBeNull();
    expect(
      container.querySelector("[data-testid='request-contact-fallback']"),
    ).not.toBeNull();
  });
});
