import { describe, expect, it, vi } from "vitest";
import { createSettingsService } from "./settings.service.js";

function settingsDatabase(
  switches: Partial<{
    experienceRequestsEnabled: boolean;
    partyRequestsEnabled: boolean;
    productRequestsEnabled: boolean;
  }> = {},
) {
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
    experienceRequestsEnabled: false,
    partyRequestsEnabled: false,
    productRequestsEnabled: false,
    ...switches,
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

  it("requires both the deployment hard gate and database switch", async () => {
    const service = createSettingsService(
      settingsDatabase({
        experienceRequestsEnabled: true,
        partyRequestsEnabled: true,
        productRequestsEnabled: true,
      }),
      null,
      {
      REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
        REQUEST_FLOW_PRODUCT_ENABLED: "true",
        REQUEST_FLOW_PARTY_ENABLED: "true",
      },
    );

    expect((await service.get()).requestCapabilities).toEqual({
      experience: true,
      product: false,
      party: true,
    });
  });

  it("keeps a database switch ineffective while its hard gate is closed", async () => {
    const service = createSettingsService(
      settingsDatabase({
        experienceRequestsEnabled: true,
        partyRequestsEnabled: true,
      }),
      null,
      {
        REQUEST_FLOW_EXPERIENCE_ENABLED: "false",
        REQUEST_FLOW_PARTY_ENABLED: "1",
      },
    );

    expect((await service.get()).requestCapabilities).toEqual({
      experience: false,
      product: false,
      party: false,
    });
  });
});
