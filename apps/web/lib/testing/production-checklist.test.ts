import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checklist = readFileSync(
  new URL(
    "../../../../docs/production-config-checklist.md",
    import.meta.url,
  ),
  "utf8",
);
const environmentExample = readFileSync(
  new URL("../../../../.env.example", import.meta.url),
  "utf8",
);

const INITIAL_DEPLOYMENT = {
  EMAIL_FROM: '"YezYY Bookings <bookings@yezyy.com>"',
  EMAIL_REPLY_TO: '"congdongdong03@gmail.com"',
  OWNER_EMAIL: '"congdongdong03@gmail.com"',
  STORE_TIMEZONE: '"Australia/Melbourne"',
  EMAIL_OUTBOX_WORKER_ENABLED: "false",
  BOOKING_MAINTENANCE_WORKER_ENABLED: "false",
  REQUEST_FLOW_EXPERIENCE_ENABLED: "false",
  REQUEST_FLOW_PARTY_ENABLED: "false",
  REQUEST_FLOW_PRODUCT_ENABLED: "false",
} as const;

function dotenvValue(source: string, name: string): string | null {
  const match = source.match(
    new RegExp(`^${name}=([^\\r\\n]+)$`, "m"),
  );
  return match?.[1]?.trim() ?? null;
}

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

  it("keeps every initial public request and worker gate disabled", () => {
    for (const [name, value] of Object.entries(INITIAL_DEPLOYMENT)) {
      expect(dotenvValue(environmentExample, name), name).toBe(value);
      expect(dotenvValue(checklist, name), name).toBe(value);
    }
  });

  it("requires a new owner instruction before experience or party opens and keeps product closed", () => {
    expect(checklist).toContain("新的负责人明确指示");
    expect(checklist).toContain(
      "`BOOKING_MAINTENANCE_WORKER_ENABLED=false`，直到普通手作或派对正式开放",
    );
    expect(checklist).toContain(
      "`REQUEST_FLOW_PRODUCT_ENABLED=false` 始终保持关闭",
    );
  });
});
