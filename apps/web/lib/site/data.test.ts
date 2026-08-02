import { describe, expect, it } from "vitest";
import { resolveHomepageHeroImage } from "./data";

describe("resolveHomepageHeroImage", () => {
  it("keeps an explicitly configured homepage image", () => {
    expect(resolveHomepageHeroImage("/configured.jpg", "/store.jpg")).toBe(
      "/configured.jpg",
    );
  });

  it("uses a verified store image when no homepage image is configured", () => {
    expect(resolveHomepageHeroImage(undefined, "/store.jpg")).toBe(
      "/store.jpg",
    );
  });

  it("keeps the honest visual fallback when neither image exists", () => {
    expect(resolveHomepageHeroImage("   ", undefined)).toBeUndefined();
  });
});
