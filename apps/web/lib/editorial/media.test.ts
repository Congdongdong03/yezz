import { describe, expect, it } from "vitest";
import { EDITORIAL_MEDIA, getEditorialMedia } from "./media";

describe("editorial media", () => {
  it("records a public source and licence for every generic asset", () => {
    expect(EDITORIAL_MEDIA).not.toHaveLength(0);

    for (const item of EDITORIAL_MEDIA) {
      expect(item.kind).toBe("inspiration");
      expect(item.imageUrl).toMatch(/^https:\/\/images\.unsplash\.com\//);
      expect(item.sourceUrl).toMatch(/^https:\/\/unsplash\.com\//);
      expect(item.licenseUrl).toBe("https://unsplash.com/license");
      expect(item.licenseLabel.en.length).toBeGreaterThan(0);
      expect(item.licenseLabel.zh.length).toBeGreaterThan(0);
    }
  });

  it("returns an editorial item by its stable identifier", () => {
    expect(getEditorialMedia("beading").id).toBe("beading");
  });
});
