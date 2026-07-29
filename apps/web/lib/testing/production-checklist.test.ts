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
    new RegExp(`^\\s*${name}=([^\\r\\n]+)$`, "m"),
  );
  return match?.[1]?.trim().replace(/\\$/, "").trim() ?? null;
}

function fencedBlockAfter(heading: string): string {
  const start = checklist.indexOf(heading);
  const fenceStart = checklist.indexOf("```bash", start);
  const fenceEnd = checklist.indexOf("```", fenceStart + 3);
  return checklist.slice(fenceStart, fenceEnd);
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

  it("keeps every executable initial and rollback assignment closed", () => {
    const initial = fencedBlockAfter("### 3. 部署 Fly 迁移和 API，能力保持关闭");
    const rollback = fencedBlockAfter("应用回滚不执行破坏性 down migration");
    const appendix = checklist.slice(
      checklist.indexOf("# -------- 邮件服务（生产必须） --------"),
      checklist.indexOf("# -------- Redis（可选） --------"),
    );
    for (const block of [initial, rollback, appendix]) {
      for (const [name, value] of Object.entries(INITIAL_DEPLOYMENT)) {
        if (name === "EMAIL_FROM" || name === "EMAIL_REPLY_TO" || name === "OWNER_EMAIL" || name === "STORE_TIMEZONE") continue;
        expect(dotenvValue(block, name), `${name} in executable block`).toBe(value);
      }
    }
    expect(checklist).not.toContain('EMAIL_FROM="YezYY <bookings@yezyy.com>"');
    expect(appendix).toContain(
      'EMAIL_FROM="YezYY Bookings <bookings@yezyy.com>"',
    );
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

  it("documents the independent customer token and canonical site URL before any worker or request gate can open", () => {
    expect(checklist).toContain("CUSTOMER_ACTION_TOKEN_SECRET");
    expect(checklist).toContain("独立生成，至少 32 字节");
    expect(checklist).toContain("规范根域名，例如 `https://yezyy.com`");
    expect(checklist).toContain("不得写入命令输出、工单或日志");
  });

  it("documents the audited two-key launch and rollback order while product remains closed", () => {
    const approvedOffering = checklist.indexOf("仅将已批准的项目设置为 `bookable=true`");
    const databaseSwitch = checklist.indexOf("通过已审计的后台/API 路径更新对应数据库开关");
    const environmentGate = checklist.indexOf("最后才开启对应 `REQUEST_FLOW_*_ENABLED`");
    const rollback = checklist.indexOf("回滚先关闭并核对环境门控和对应数据库开关");
    expect(approvedOffering).toBeGreaterThan(-1);
    expect(databaseSwitch).toBeGreaterThan(approvedOffering);
    expect(environmentGate).toBeGreaterThan(databaseSwitch);
    expect(rollback).toBeGreaterThan(environmentGate);
    expect(checklist).toContain("产品始终保持 `false`，没有启用步骤");
  });
});
