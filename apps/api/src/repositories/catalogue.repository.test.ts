import type { Db } from "@yezz/db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createCatalogueRepository } from "./catalogue.repository.js";

function createQueryHarness() {
  const whereConditions: SQL[] = [];
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    where: (condition: SQL) => {
      whereConditions.push(condition);
      return query;
    },
    orderBy: () => query,
  };
  const db = { select: () => query } as unknown as Db;
  return { repository: createCatalogueRepository(db), whereConditions };
}

describe("catalogue repository", () => {
  it("filters the list query to published entries", () => {
    const { repository, whereConditions } = createQueryHarness();

    repository.findPublishedWithVariants();

    const query = new PgDialect().sqlToQuery(whereConditions[0]!);
    expect(query.sql).toContain('"catalogue_entries"."published" = $1');
    expect(query.params).toEqual([true]);
  });

  it("filters a slug lookup to a published entry", () => {
    const { repository, whereConditions } = createQueryHarness();

    repository.findPublishedBySlugWithVariants("plaster-painting");

    const query = new PgDialect().sqlToQuery(whereConditions[0]!);
    expect(query.sql).toContain('"catalogue_entries"."published" = $1');
    expect(query.sql).toContain('"catalogue_entries"."slug" = $2');
    expect(query.params).toEqual([true, "plaster-painting"]);
  });
});
