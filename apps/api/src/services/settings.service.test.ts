import { describe, expect, it, vi } from "vitest";
import { createSettingsService } from "./settings.service.js";

function settingsDatabase() {
  const row = {
    id: crypto.randomUUID(),
    storeName: "YezYY Test",
    address: "Test-only address",
    businessHours: null,
    phone: "0400000000",
    email: "contact@closure.test",
    wechatId: null,
    wechatQrUrl: null,
    heroImageUrl: null,
    instagram: null,
    xiaohongshu: null,
    googleMapUrl: null,
    seoTitle: null,
    seoDescription: null,
  };
  const limit = vi.fn(async () => [row]);
  const from = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ from }));
  return { select } as never;
}

describe("request capabilities", () => {
  it("defaults every public request capability to false", async () => {
    const service = createSettingsService(settingsDatabase(), null, {});

    expect((await service.get()).requestCapabilities).toEqual({
      experience: false,
      product: false,
      party: false,
    });
  });

  it("enables only flags set to the exact safe value true", async () => {
    const service = createSettingsService(settingsDatabase(), null, {
      REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
      REQUEST_FLOW_PRODUCT_ENABLED: "TRUE",
      REQUEST_FLOW_PARTY_ENABLED: "1",
    });

    expect((await service.get()).requestCapabilities).toEqual({
      experience: true,
      product: false,
      party: false,
    });
  });
});
