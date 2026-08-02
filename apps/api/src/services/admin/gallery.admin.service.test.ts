import { describe, expect, it } from "vitest";
import { GALLERY_CATEGORIES, isGalleryCategory } from "./gallery.admin.service.js";

describe("admin gallery categories", () => {
  it("accepts the new studio media roles and preserves legacy categories", () => {
    expect(GALLERY_CATEGORIES).toEqual(
      expect.arrayContaining([
        "store",
        "arrival",
        "process",
        "party",
        "community",
        "works",
        "birthday",
      ]),
    );
    expect(isGalleryCategory("arrival")).toBe(true);
    expect(isGalleryCategory("unknown")).toBe(false);
  });
});
