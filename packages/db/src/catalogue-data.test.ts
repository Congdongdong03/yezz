import { describe, expect, it } from "vitest";
import { PUBLIC_CATALOGUE_ENTRIES } from "./catalogue-data.js";
import { LIVE_DIY_PROJECTS } from "./live-booking-catalogue.js";

describe("approved public catalogue data", () => {
  it("defines the nine approved public catalogue entries", () => {
    expect(PUBLIC_CATALOGUE_ENTRIES.map((entry) => entry.slug)).toEqual([
      "deco-cream-two-hair-clips",
      "deco-cream-mini-drawers",
      "deco-cream-phone-case",
      "deco-cream-lamp",
      "deco-cream-medium-storage",
      "deco-cream-large-storage",
      "plaster-painting",
      "beading",
      "melty-beads",
    ]);
    expect(
      PUBLIC_CATALOGUE_ENTRIES.find(
        (entry) => entry.slug === "plaster-painting",
      )?.projectSlugs,
    ).toEqual([
      "paint-clay-figurine-mini",
      "paint-clay-figurine-small",
      "paint-clay-figurine-medium",
      "paint-clay-figurine-large",
    ]);
  });

  it("uses the approved customer-facing prices and duration ranges", () => {
    expect(
      LIVE_DIY_PROJECTS.find(
        (project) => project.slug === "air-dry-phone-case",
      ),
    ).toMatchObject({ priceMinCents: 6600, priceMaxCents: 7600 });
    expect(
      LIVE_DIY_PROJECTS.find((project) => project.slug === "air-dry-lamp"),
    ).toMatchObject({ priceMinCents: 4300, priceMaxCents: 9800 });
    expect(
      LIVE_DIY_PROJECTS.find((project) => project.slug === "beading"),
    ).toMatchObject({
      priceMinCents: 4300,
      styles: [
        { name: { en: "Bracelet", zh: "手链" }, price: "43.00" },
        { name: { en: "Phone Strap 20cm", zh: "手机链 20cm" }, price: "43.00" },
        { name: { en: "Phone Strap 30cm", zh: "手机链 30cm" }, price: "60.50" },
        { name: { en: "Phone Strap 40cm", zh: "手机链 40cm" }, price: "71.50" },
        { name: { en: "Bag Chain", zh: "包链" }, price: "93.50" },
      ],
    });
    expect(
      LIVE_DIY_PROJECTS.find((project) => project.slug === "melty-bead-craft"),
    ).toMatchObject({
      priceMinCents: 4950,
      extraTimeMinutes: 30,
      extraTimePriceCents: 1650,
    });
    expect(
      PUBLIC_CATALOGUE_ENTRIES.filter((entry) =>
        entry.slug.startsWith("deco-cream-"),
      ).map((entry) => entry.durationDisplay),
    ).toEqual([
      { en: "15–30 min", zh: "15–30 分钟" },
      { en: "15–30 min", zh: "15–30 分钟" },
      { en: "30–45 min", zh: "30–45 分钟" },
      { en: "30–45 min", zh: "30–45 分钟" },
      { en: "30–45 min", zh: "30–45 分钟" },
      { en: "30–45 min", zh: "30–45 分钟" },
    ]);
  });
});
