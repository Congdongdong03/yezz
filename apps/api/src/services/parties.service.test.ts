import { describe, expect, it } from "vitest";
import { mapPartyRow } from "./parties.service.js";

describe("party operational DTO", () => {
  it("returns the approved duration, fee, spending, and parent limits", () => {
    const result = mapPartyRow({
      id: "party-1",
      name: { en: "90-minute party package", zh: "90分钟派对套餐" },
      slug: "party-90",
      description: null,
      includes: [],
      coverImageUrl: null,
      imageUrls: [],
      minPeople: 4,
      maxPeople: 8,
      priceIndicator: null,
      guestDurationMinutes: 90,
      setupMinutes: 30,
      cleanupMinutes: 30,
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
      minParents: 1,
      maxParents: 2,
      tags: [],
      sortOrder: 0,
    } as never);

    expect(result).toMatchObject({
      guestDurationMinutes: 90,
      setupMinutes: 30,
      cleanupMinutes: 30,
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
      minParents: 1,
      maxParents: 2,
    });
  });
});
