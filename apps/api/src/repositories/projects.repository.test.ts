import type { Db } from "@yezz/db";
import { describe, expect, it, vi } from "vitest";
import { createProjectsRepository } from "./projects.repository.js";

function createRepositoryHarness(priceCurrency = "AUD") {
  let inserted: Record<string, unknown> | undefined;
  let updated: Record<string, unknown> | undefined;
  const project = {
    id: "00000000-0000-4000-8000-000000000001",
    priceCurrency,
  };

  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        inserted = values;
        return {
          returning: vi.fn(async () => [project]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updated = values;
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => [project]),
          })),
        };
      }),
    })),
  } as unknown as Db;

  return {
    repository: createProjectsRepository(db),
    getInserted: () => inserted,
    getUpdated: () => updated,
  };
}

const validProject = {
  categoryId: "00000000-0000-4000-8000-000000000002",
  name: { en: "Melty Bead Craft", zh: "拼豆手作" },
  slug: "melty-bead-craft",
  projectType: "experience" as const,
};

describe("projects repository AUD persistence", () => {
  it("writes AUD when a project is created", async () => {
    const harness = createRepositoryHarness();

    const project = await harness.repository.create(validProject);

    expect(project?.priceCurrency).toBe("AUD");
    expect(harness.getInserted()).toMatchObject({ priceCurrency: "AUD" });
  });

  it("writes AUD when a project is updated", async () => {
    const harness = createRepositoryHarness();

    const project = await harness.repository.update(
      "00000000-0000-4000-8000-000000000001",
      {
        name: { en: "Updated", zh: "已更新" },
        priceCurrency: "AUD",
      },
    );

    expect(project?.priceCurrency).toBe("AUD");
    expect(harness.getUpdated()).toMatchObject({ priceCurrency: "AUD" });
  });

  it("does not rewrite an explicit historical currency when none is selected", async () => {
    const harness = createRepositoryHarness("CNY");

    const project = await harness.repository.update(
      "00000000-0000-4000-8000-000000000001",
      { name: { en: "Updated", zh: "已更新" } },
    );

    expect(project?.priceCurrency).toBe("CNY");
    expect(harness.getUpdated()).not.toHaveProperty("priceCurrency");
  });
});
