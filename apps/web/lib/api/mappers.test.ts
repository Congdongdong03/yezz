import { describe, expect, it } from "vitest";
import { mapSiteSettingsFromApi } from "./mappers";
import type { ApiSiteSettings } from "./types";

const settings: Omit<ApiSiteSettings, "requestCapabilities"> = {
  id: "settings",
  storeName: "YezYY",
  address: null,
  businessHours: null,
  phone: null,
  email: null,
  wechatId: null,
  wechatQrUrl: null,
  heroImageUrl: null,
  instagram: null,
  xiaohongshu: null,
  googleMapUrl: null,
  seoTitle: null,
  seoDescription: null,
};

describe("mapSiteSettingsFromApi", () => {
  it("fails every request capability closed when rollout data is absent", () => {
    const result = mapSiteSettingsFromApi(
      settings as ApiSiteSettings,
    );

    expect(result.requestCapabilities).toEqual({
      experience: false,
      product: false,
      party: false,
    });
  });

  it("accepts only literal boolean true capability values", () => {
    const result = mapSiteSettingsFromApi({
      ...settings,
      requestCapabilities: {
        experience: true,
        product: "true",
        party: 1,
      },
    } as unknown as ApiSiteSettings);

    expect(result.requestCapabilities).toEqual({
      experience: true,
      product: false,
      party: false,
    });
  });
});
