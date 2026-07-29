import crypto from "node:crypto";
import postgres, { type Sql } from "postgres";

export type ClosureFlow = "experience" | "product" | "party";

export const APPROVED_WEEKLY_HOURS = [
  { weekday: 0, opensAt: "10:00", closesAt: "17:00", isClosed: false },
  { weekday: 1, opensAt: "09:30", closesAt: "17:00", isClosed: false },
  { weekday: 2, opensAt: "09:30", closesAt: "17:00", isClosed: false },
  { weekday: 3, opensAt: "09:30", closesAt: "17:00", isClosed: false },
  { weekday: 4, opensAt: "09:30", closesAt: "20:30", isClosed: false },
  { weekday: 5, opensAt: "09:30", closesAt: "20:30", isClosed: false },
  { weekday: 6, opensAt: "09:30", closesAt: "17:30", isClosed: false },
] as const;

type LiveProjectSeedInput = {
  categorySlug: string;
  slug: string;
  name: { en: string; zh: string };
  priceMinCents: number;
  priceMaxCents: number;
  durationMinutes: number;
  variantSelectedInStore: boolean;
  extraTimeMinutes?: number;
  extraTimePriceCents?: number;
};

type LivePartySeedInput = {
  slug: string;
  name: { en: string; zh: string };
  guestDurationMinutes: number;
  setupMinutes: number;
  cleanupMinutes: number;
  venueFeeCents: number;
  minPeople: number;
  maxPeople: number;
  minSpendPerPersonCents: number;
  minParents: number;
  maxParents: number;
};

export type LiveBookingFixture = {
  sql: Sql;
  runId: string;
  bookingDate: string;
  ownerEmail: string;
  projects: {
    short: { id: string; seed: LiveProjectSeedInput };
    long: { id: string; seed: LiveProjectSeedInput };
    bySlug: Map<string, { id: string; seed: LiveProjectSeedInput }>;
  };
  parties: {
    short: { id: string; seed: LivePartySeedInput };
    long: { id: string; seed: LivePartySeedInput };
    bySlug: Map<string, { id: string; seed: LivePartySeedInput }>;
  };
  requestIds: Set<string>;
  makeReminderEligible(bookingId: string): Promise<void>;
  cleanup(): Promise<void>;
};

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

function futureBookingDate(): string {
  const now = new Date();
  const candidate = new Date(now.getTime() + 3 * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(candidate);
}

function melbourneDateTime(value: Date): {
  date: string;
  startTime: string;
  endTime: string;
} {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const end = new Date(value.getTime() + 60 * 60 * 1000);
  const endParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(end)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    startTime: `${parts.hour}:${parts.minute}`,
    endTime: `${endParts.hour}:${endParts.minute}`,
  };
}

export async function seedLiveBookingFixture(input: {
  weeklyHours: readonly {
    weekday: number;
    opensAt: string;
    closesAt: string;
    isClosed: boolean;
  }[];
  projects: readonly LiveProjectSeedInput[];
  parties: readonly LivePartySeedInput[];
  capabilities: {
    experience: boolean;
    party: boolean;
    product: boolean;
  };
}): Promise<LiveBookingFixture> {
  const sql = postgres(testDatabaseUrl(), { max: 1 });
  const runId = crypto.randomUUID();
  const requestIds = new Set<string>();
  const projects = new Map<
    string,
    { id: string; seed: LiveProjectSeedInput }
  >();
  const parties = new Map<
    string,
    { id: string; seed: LivePartySeedInput }
  >();
  const createdCategoryIds = new Set<string>();
  const createdProjectIds = new Set<string>();
  const createdPartyIds = new Set<string>();
  const rateLimitSecret = process.env.RATE_LIMIT_HASH_SECRET?.trim();
  if (!rateLimitSecret) {
    await sql.end();
    throw new Error(
      "RATE_LIMIT_HASH_SECRET is required for live closure cleanup",
    );
  }

  try {
    await sql.begin(async (transaction) => {
      const settings = await transaction<{ id: string }[]>`
        select id from site_settings order by created_at limit 2
      `;
      if (settings.length !== 1) {
        throw new Error(
          "Live closure requires exactly one isolated site_settings row",
        );
      }
      await transaction`
        update site_settings
        set
          experience_requests_enabled = ${input.capabilities.experience},
          party_requests_enabled = ${input.capabilities.party},
          product_requests_enabled = ${input.capabilities.product},
          updated_at = now()
        where id = ${settings[0]!.id}
      `;

      for (const hours of input.weeklyHours) {
        await transaction`
          insert into studio_weekly_hours (
            weekday, opens_at, closes_at, is_closed
          )
          values (
            ${hours.weekday},
            ${hours.opensAt},
            ${hours.closesAt},
            ${hours.isClosed}
          )
          on conflict (weekday) do update set
            opens_at = excluded.opens_at,
            closes_at = excluded.closes_at,
            is_closed = excluded.is_closed
        `;
      }

      // Reuse the approved catalogue where it exists, and otherwise create it
      // under its canonical slugs. This lets the browser exercise the exact
      // public offerings without introducing look-alike duplicates that would
      // make the party page deliberately fail closed.
      const categoryIds = new Map<string, string>();
      for (const categorySlug of new Set(
        input.projects.map((project) => project.categorySlug),
      )) {
        const [existing] = await transaction<{ id: string }[]>`
          select id from project_categories where slug = ${categorySlug}
        `;
        if (existing) {
          categoryIds.set(categorySlug, existing.id);
          continue;
        }
        const id = crypto.randomUUID();
        await transaction`
          insert into project_categories (id, name, slug, sort_order)
          values (
            ${id},
            ${transaction.json({ en: categorySlug, zh: categorySlug })},
            ${categorySlug},
            9000
          )
        `;
        categoryIds.set(categorySlug, id);
        createdCategoryIds.add(id);
      }

      for (const project of input.projects) {
        const [row] = await transaction<{ id: string }[]>`
          select id from diy_projects where slug = ${project.slug}
        `;
        if (row) {
          await transaction`
            update diy_projects set bookable = true, updated_at = now()
            where id = ${row.id}
          `;
          projects.set(project.slug, { id: row.id, seed: project });
          continue;
        }

        const categoryId = categoryIds.get(project.categorySlug);
        if (!categoryId) throw new Error(`Missing category ${project.categorySlug}`);
        const id = crypto.randomUUID();
        await transaction`
          insert into diy_projects (
            id, category_id, name, slug, project_type, description,
            price_range, price_min, price_max, price_currency, duration,
            duration_minutes, bookable, variant_selected_in_store,
            extra_time_minutes, extra_time_price_cents, tags, sort_order
          )
          values (
            ${id}, ${categoryId}, ${transaction.json(project.name)}, ${project.slug},
            'experience', ${transaction.json({ en: "Closure catalogue", zh: "闭环目录" })},
            ${`A$${(project.priceMinCents / 100).toFixed(2)}`},
            ${project.priceMinCents}, ${project.priceMaxCents}, 'AUD',
            ${`${project.durationMinutes} minutes`}, ${project.durationMinutes}, true,
            ${project.variantSelectedInStore}, ${project.extraTimeMinutes ?? null},
            ${project.extraTimePriceCents ?? null}, ${[]}, 9000
          )
        `;
        createdProjectIds.add(id);
        projects.set(project.slug, { id, seed: project });
      }

      for (const party of input.parties) {
        const [row] = await transaction<{ id: string }[]>`
          select id from party_packages where slug = ${party.slug}
        `;
        if (row) {
          parties.set(party.slug, { id: row.id, seed: party });
          continue;
        }
        const id = crypto.randomUUID();
        await transaction`
          insert into party_packages (
            id, name, slug, description, includes, image_urls,
            min_people, max_people, guest_duration_minutes, setup_minutes,
            cleanup_minutes, venue_fee_cents, min_spend_per_person_cents,
            min_parents, max_parents, tags, sort_order
          )
          values (
            ${id}, ${transaction.json(party.name)}, ${party.slug},
            ${transaction.json({ en: "Closure catalogue", zh: "闭环目录" })},
            ${transaction.json([])}, ${[]}, ${party.minPeople}, ${party.maxPeople},
            ${party.guestDurationMinutes}, ${party.setupMinutes}, ${party.cleanupMinutes},
            ${party.venueFeeCents}, ${party.minSpendPerPersonCents},
            ${party.minParents}, ${party.maxParents}, ${[]}, 9000
          )
        `;
        createdPartyIds.add(id);
        parties.set(party.slug, { id, seed: party });
      }
    });
  } catch (error) {
    await sql.end();
    throw error;
  }

  const shortProject = [...projects.values()].find(
    ({ seed }) => seed.durationMinutes === 30,
  );
  const longProject = [...projects.values()].find(
    ({ seed }) => seed.durationMinutes === 60,
  );
  const shortParty = [...parties.values()].find(
    ({ seed }) => seed.venueFeeCents === 9500,
  );
  const longParty = [...parties.values()].find(
    ({ seed }) => seed.venueFeeCents === 14500,
  );
  if (!shortProject || !longProject || !shortParty || !longParty) {
    await sql.end();
    throw new Error("Live closure fixture is missing approved offerings");
  }

  return {
    sql,
    runId,
    bookingDate: futureBookingDate(),
    ownerEmail: "congdongdong03@gmail.com",
    projects: {
      short: shortProject,
      long: longProject,
      bySlug: projects,
    },
    parties: {
      short: shortParty,
      long: longParty,
      bySlug: parties,
    },
    requestIds,
    async makeReminderEligible(bookingId: string) {
      if (!requestIds.has(bookingId)) {
        throw new Error("Cannot modify an untracked closure booking");
      }
      const appointment = melbourneDateTime(
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );
      await sql.begin(async (transaction) => {
        await transaction`
          update bookings
          set
            slot_date = ${appointment.date},
            slot_start_time = ${appointment.startTime},
            slot_end_time = ${appointment.endTime},
            updated_at = now()
          where id = ${bookingId}
        `;
        await transaction`
          update request_status_events
          set created_at = now() - interval '5 minutes'
          where booking_id = ${bookingId}
            and to_status = 'confirmed'
        `;
      });
    },
    async cleanup() {
      try {
        await sql.begin(async (transaction) => {
          for (const requestId of requestIds) {
            await transaction`
              delete from email_outbox where booking_id = ${requestId}
            `;
            await transaction`
              delete from admin_request_reads where booking_id = ${requestId}
            `;
            await transaction`
              delete from request_status_events where booking_id = ${requestId}
            `;
            await transaction`delete from bookings where id = ${requestId}`;
          }
          const subjectHash = crypto
            .createHmac("sha256", rateLimitSecret)
            .update("booking\n203.0.113.10")
            .digest("hex");
          await transaction`
            delete from request_rate_limits
            where scope = 'booking'
              and subject_hash = ${subjectHash}
          `;
          for (const project of input.projects) {
            if (createdProjectIds.has(projects.get(project.slug)!.id)) continue;
            await transaction`
              update diy_projects set bookable = false, updated_at = now()
              where slug = ${project.slug}
            `;
          }
          for (const projectId of createdProjectIds) {
            await transaction`delete from diy_projects where id = ${projectId}`;
          }
          for (const categoryId of createdCategoryIds) {
            await transaction`delete from project_categories where id = ${categoryId}`;
          }
          for (const partyId of createdPartyIds) {
            await transaction`delete from party_packages where id = ${partyId}`;
          }
        });
      } finally {
        await sql.end();
      }
    },
  };
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
    await transaction`
      update site_settings
      set
        experience_requests_enabled = ${flow === "experience"},
        party_requests_enabled = ${flow === "party"},
        product_requests_enabled = ${flow === "product"},
        updated_at = now()
    `;
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
