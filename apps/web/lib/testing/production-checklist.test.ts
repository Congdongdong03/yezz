import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checklist = readFileSync(
  new URL(
    "../../../../docs/production-config-checklist.md",
    import.meta.url,
  ),
  "utf8",
);

describe("production closure checklist", () => {
  it("reconciles capacity counters with all active reservations", () => {
    expect(checklist).toContain(
      "select count(*) as capacity_counter_mismatches",
    );
  });

  it("never rolls back to a pre-gate API or web image", () => {
    expect(checklist).toContain(
      "回滚目标必须仍包含能力开关",
    );
    expect(checklist).not.toContain(
      "fly deploy --image <PREVIOUS_FLY_IMAGE>",
    );
    expect(checklist).not.toContain(
      "vercel rollback <PREVIOUS_VERCEL_DEPLOYMENT_URL>",
    );
  });

  it("expects disabled creates to avoid durable rate-limit state", () => {
    expect(checklist).toContain(
      "能力关闭时不得产生 `request_rate_limits`",
    );
  });
});
