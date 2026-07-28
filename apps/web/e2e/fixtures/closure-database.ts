import crypto from "node:crypto";
import postgres, { type Sql } from "postgres";

export type ClosureFlow = "experience" | "product" | "party";

export type ClosureFixture = {
  sql: Sql;
  flow: ClosureFlow;
  label: string;
  categoryId: string | null;
  projectId: string | null;
  styleId: string | null;
  partyPackageId: string | null;
  slug: string;
  offering: { en: string; zh: string };
  style: { en: string; zh: string } | null;
  slotId: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  capacity: number;
  requestIds: Set<string>;
  rateLimitSubjects: Set<string>;
  cleanup(): Promise<void>;
};

function testDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("Closure E2E requires the isolated local PostgreSQL URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Closure E2E requires the isolated local PostgreSQL URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname !== "127.0.0.1" ||
    !/^\d+$/.test(parsed.port) ||
    parsed.username !== "closure_test" ||
    parsed.pathname !== "/yezyy_closure_test"
  ) {
    throw new Error("Closure E2E requires the isolated local PostgreSQL URL");
  }
  return value;
}

function futureWednesday(): string {
  const now = new Date();
  for (let offset = 3; offset <= 20; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(candidate);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 3) return date;
  }
  throw new Error("Unable to choose a future Wednesday");
}

export async function createClosureFixture(
  flow: ClosureFlow,
  options: { capacity?: number } = {},
): Promise<ClosureFixture> {
  const sql = postgres(testDatabaseUrl(), { max: 1 });
  const label = crypto.randomUUID();
  const categoryId = flow === "party" ? null : crypto.randomUUID();
  const projectId = flow === "party" ? null : crypto.randomUUID();
  const styleId = flow === "product" ? crypto.randomUUID() : null;
  const partyPackageId = flow === "party" ? crypto.randomUUID() : null;
  const slotId = crypto.randomUUID();
  const slug = `closure-${flow}-${label}`;
  const slotDate = futureWednesday();
  const [slotStartTime, slotEndTime] =
    flow === "experience"
      ? ["10:00", "11:00"]
      : flow === "product"
        ? ["12:00", "13:00"]
        : ["14:00", "15:30"];
  const capacity = options.capacity ?? (flow === "party" ? 12 : 8);
  const offering = {
    en: `Closure ${flow} ${label.slice(0, 8)}`,
    zh: `闭环${flow === "party" ? "派对" : flow === "product" ? "产品" : "体验"}${label.slice(0, 8)}`,
  };
  const style =
    flow === "product"
      ? {
          en: `Closure style ${label.slice(0, 8)}`,
          zh: `闭环款式${label.slice(0, 8)}`,
        }
      : null;
  const requestIds = new Set<string>();
  const rateLimitSubjects = new Set<string>();
  rateLimitSubjects.add(
    `${flow === "product" ? "cart-order" : "booking"}\n203.0.113.10`,
  );

  await sql.begin(async (transaction) => {
    if (categoryId) {
      await transaction`
        insert into project_categories (id, name, slug, sort_order)
        values (
          ${categoryId},
          ${transaction.json({ en: "Closure", zh: "闭环测试" })},
          ${`closure-category-${label}`},
          9000
        )
      `;
    }
    if (projectId && categoryId) {
      await transaction`
        insert into diy_projects (
          id, category_id, name, slug, project_type, description,
          price_range, price_currency, duration, sort_order
        )
        values (
          ${projectId},
          ${categoryId},
          ${transaction.json(offering)},
          ${slug},
          ${flow},
          ${transaction.json({
            en: "Isolated closure E2E fixture",
            zh: "隔离闭环测试数据",
          })},
          ${flow === "product" ? "A$49" : "A$43"},
          'AUD',
          '60 min',
          9000
        )
      `;
    }
    if (styleId && projectId && style) {
      await transaction`
        insert into project_styles (
          id, project_id, name, price, sort_order
        )
        values (
          ${styleId},
          ${projectId},
          ${transaction.json(style)},
          'A$49',
          1
        )
      `;
    }
    if (partyPackageId) {
      await transaction`
        insert into party_packages (
          id, name, slug, description, includes, min_people, max_people,
          price_indicator, sort_order
        )
        values (
          ${partyPackageId},
          ${transaction.json(offering)},
          ${slug},
          ${transaction.json({
            en: "Isolated closure E2E fixture",
            zh: "隔离闭环测试数据",
          })},
          ${transaction.json([
            { en: "Studio host", zh: "工作室主持" },
          ])},
          4,
          12,
          'A$ closure fixture',
          9000
        )
      `;
    }
    await transaction`
      insert into time_slots (
        id, date, start_time, end_time, capacity, booked_count,
        category_id, is_available, notes
      )
      values (
        ${slotId},
        ${slotDate},
        ${slotStartTime},
        ${slotEndTime},
        ${capacity},
        0,
        ${flow === "experience" ? categoryId : null},
        true,
        ${`closure:${label}`}
      )
    `;
  });

  return {
    sql,
    flow,
    label,
    categoryId,
    projectId,
    styleId,
    partyPackageId,
    slug,
    offering,
    style,
    slotId,
    slotDate,
    slotStartTime,
    slotEndTime,
    capacity,
    requestIds,
    rateLimitSubjects,
    async cleanup() {
      try {
        await sql.begin(async (transaction) => {
          for (const requestId of requestIds) {
            await transaction`
              delete from email_outbox
              where booking_id = ${requestId}
                 or cart_order_id = ${requestId}
            `;
            await transaction`
              delete from admin_request_reads
              where booking_id = ${requestId}
                 or cart_order_id = ${requestId}
            `;
            await transaction`
              delete from request_status_events
              where booking_id = ${requestId}
                 or cart_order_id = ${requestId}
            `;
            await transaction`delete from bookings where id = ${requestId}`;
            await transaction`delete from cart_orders where id = ${requestId}`;
          }
          const rateLimitSecret = process.env.RATE_LIMIT_HASH_SECRET?.trim();
          if (rateLimitSubjects.size > 0 && !rateLimitSecret) {
            throw new Error(
              "RATE_LIMIT_HASH_SECRET is required to clean closure identities",
            );
          }
          for (const tracked of rateLimitSubjects) {
            const separator = tracked.indexOf("\n");
            const scope = tracked.slice(0, separator);
            const subject = tracked.slice(separator + 1);
            const subjectHash = crypto
              .createHmac("sha256", rateLimitSecret!)
              .update(`${scope}\n${subject.trim().toLowerCase()}`)
              .digest("hex");
            await transaction`
              delete from request_rate_limits
              where scope = ${scope}
                and subject_hash = ${subjectHash}
            `;
          }
          await transaction`delete from time_slots where id = ${slotId}`;
          if (projectId) {
            await transaction`delete from diy_projects where id = ${projectId}`;
          }
          if (categoryId) {
            await transaction`
              delete from project_categories where id = ${categoryId}
            `;
          }
          if (partyPackageId) {
            await transaction`
              delete from party_packages where id = ${partyPackageId}
            `;
          }
        });
      } finally {
        await sql.end();
      }
    },
  };
}

export async function waitForDatabaseRow<T>(
  load: () => Promise<T | null>,
  description: string,
  timeoutMilliseconds = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const result = await load();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}
