import { describe, expect, it } from "vitest";
import { selectStudioMedia } from "./studio-media";

const image = (
  id: string,
  category: string,
  order: number,
  imageUrl = `/${id}.jpg`,
) => ({
  _id: id,
  category,
  order,
  imageUrl,
  caption: { en: id, zh: id },
});

describe("selectStudioMedia", () => {
  it("selects explicit studio roles in stable display order", () => {
    const selected = selectStudioMedia([
      image("party-2", "party", 20),
      image("arrival-1", "arrival", 4),
      image("store-2", "store", 8),
      image("party-1", "party", 10),
      image("process-1", "process", 3),
      image("store-1", "store", 2),
      image("community-1", "community", 1),
    ]);

    expect(selected.hero?._id).toBe("store-1");
    expect(selected.arrival?._id).toBe("arrival-1");
    expect(selected.store.map((entry) => entry._id)).toEqual([
      "store-1",
      "store-2",
    ]);
    expect(selected.process.map((entry) => entry._id)).toEqual(["process-1"]);
    expect(selected.party.map((entry) => entry._id)).toEqual([
      "party-1",
      "party-2",
    ]);
    expect(selected.community.map((entry) => entry._id)).toEqual([
      "community-1",
    ]);
  });

  it("uses a store image for arrival only when no arrival image exists", () => {
    const selected = selectStudioMedia([image("store-1", "store", 1)]);

    expect(selected.hero?._id).toBe("store-1");
    expect(selected.arrival?._id).toBe("store-1");
  });

  it("never relabels legacy or blank-url images as consented community media", () => {
    const selected = selectStudioMedia([
      image("birthday-1", "birthday", 1),
      image("works-1", "works", 2),
      image("blank-community", "community", 3, "   "),
    ]);

    expect(selected.community).toEqual([]);
    expect(selected.legacy.map((entry) => entry._id)).toEqual([
      "birthday-1",
      "works-1",
    ]);
  });
});
