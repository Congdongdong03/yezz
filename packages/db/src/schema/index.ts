import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type LocalizedString = { en: string; zh: string };

export const userRoleEnum = pgEnum("user_role", ["admin", "staff"]);
export const projectTypeEnum = pgEnum("project_type", ["experience", "product"]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectCategories = pgTable("project_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: jsonb("name").$type<LocalizedString>().notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: jsonb("description").$type<LocalizedString>(),
  icon: varchar("icon", { length: 64 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const diyProjects = pgTable("diy_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => projectCategories.id, { onDelete: "restrict" }),
  name: jsonb("name").$type<LocalizedString>().notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  projectType: projectTypeEnum("project_type").notNull(),
  description: jsonb("description").$type<LocalizedString>(),
  priceRange: varchar("price_range", { length: 64 }),
  priceMin: integer("price_min"),
  priceMax: integer("price_max"),
  priceCurrency: varchar("price_currency", { length: 10 }).default("AUD"),
  duration: varchar("duration", { length: 64 }),
  tags: text("tags").array(),
  sortOrder: integer("sort_order").notNull().default(0),
  coverImageUrl: text("cover_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectStyles = pgTable("project_styles", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => diyProjects.id, { onDelete: "cascade" }),
  name: jsonb("name").$type<LocalizedString>().notNull(),
  imageUrl: text("image_url"),
  price: varchar("price", { length: 32 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const projectImages = pgTable("project_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => diyProjects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const partyPackages = pgTable("party_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: jsonb("name").$type<LocalizedString>().notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: jsonb("description").$type<LocalizedString>(),
  includes: jsonb("includes").$type<LocalizedString[]>().notNull().default([]),
  coverImageUrl: text("cover_image_url"),
  imageUrls: text("image_urls").array().notNull().default([]),
  minPeople: integer("min_people").notNull().default(2),
  maxPeople: integer("max_people").notNull().default(20),
  priceIndicator: varchar("price_indicator", { length: 128 }),
  tags: text("tags").array(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const galleryImages = pgTable("gallery_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: text("image_url").notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  caption: jsonb("caption").$type<LocalizedString>(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectKey: varchar("object_key", { length: 512 }).notNull().unique(),
  url: text("url").notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedById: uuid("uploaded_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timeSlots = pgTable(
  "time_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    startTime: varchar("start_time", { length: 8 }).notNull(),
    endTime: varchar("end_time", { length: 8 }).notNull(),
    capacity: integer("capacity").notNull(),
    bookedCount: integer("booked_count").notNull().default(0),
    categoryId: uuid("category_id").references(() => projectCategories.id, {
      onDelete: "set null",
    }),
    isAvailable: boolean("is_available").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("time_slots_capacity_positive", sql`${table.capacity} >= 1`),
    check("time_slots_booked_nonnegative", sql`${table.bookedCount} >= 0`),
    check(
      "time_slots_booked_within_capacity",
      sql`${table.bookedCount} <= ${table.capacity}`,
    ),
    check(
      "time_slots_time_format",
      sql`${table.startTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.endTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
    check("time_slots_time_order", sql`${table.startTime} < ${table.endTime}`),
    uniqueIndex("time_slots_effective_slot_unique").on(
      table.date,
      table.startTime,
      table.endTime,
      sql`COALESCE(${table.categoryId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
  ],
);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }).notNull(),
  wechat: varchar("wechat", { length: 128 }),
  email: varchar("email", { length: 255 }),
  preferredDate: date("preferred_date"),
  numberOfPeople: integer("number_of_people"),
  activityType: varchar("activity_type", { length: 32 }),
  interestedProject: varchar("interested_project", { length: 255 }),
  message: text("message"),
  locale: varchar("locale", { length: 8 }),
  timeSlotId: uuid("time_slot_id").references(() => timeSlots.id, {
    onDelete: "restrict",
  }),
  requestKind: varchar("request_kind", { length: 32 }).notNull().default("experience"),
  projectId: uuid("project_id").references(() => diyProjects.id, {
    onDelete: "restrict",
  }),
  partyPackageId: uuid("party_package_id").references(() => partyPackages.id, {
    onDelete: "restrict",
  }),
  offeringNameSnapshot: jsonb("offering_name_snapshot").$type<LocalizedString>(),
  offeringPriceSnapshot: varchar("offering_price_snapshot", { length: 128 }),
  slotDate: date("slot_date"),
  slotStartTime: varchar("slot_start_time", { length: 8 }),
  slotEndTime: varchar("slot_end_time", { length: 8 }),
  slotTimezone: varchar("slot_timezone", { length: 64 })
    .notNull()
    .default("Australia/Melbourne"),
  idempotencyKey: uuid("idempotency_key").notNull().defaultRandom(),
  isRead: boolean("is_read").notNull().default(false),
  status: orderStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("bookings_idempotency_key_unique").on(table.idempotencyKey),
  check(
    "bookings_request_kind_valid",
    sql`${table.requestKind} IN ('experience', 'party')`,
  ),
]);

export const cartOrders = pgTable("cart_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }).notNull(),
  wechat: varchar("wechat", { length: 128 }),
  email: varchar("email", { length: 255 }),
  message: text("message"),
  timeSlotId: uuid("time_slot_id").references(() => timeSlots.id, {
    onDelete: "restrict",
  }),
  numberOfPeople: integer("number_of_people"),
  preferredDate: date("preferred_date"),
  slotDate: date("slot_date"),
  slotStartTime: varchar("slot_start_time", { length: 8 }),
  slotEndTime: varchar("slot_end_time", { length: 8 }),
  slotTimezone: varchar("slot_timezone", { length: 64 })
    .notNull()
    .default("Australia/Melbourne"),
  locale: varchar("locale", { length: 8 }),
  idempotencyKey: uuid("idempotency_key").notNull().defaultRandom(),
  isRead: boolean("is_read").notNull().default(false),
  status: orderStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("cart_orders_idempotency_key_unique").on(table.idempotencyKey),
]);

export type CartSessionItem = {
  projectId: string;
  projectSlug: string;
  projectName: { en: string; zh: string };
  projectType: "experience" | "product";
  imageUrl?: string;
  styleName?: { en: string; zh: string };
  date?: string;
  people?: number;
  price?: string;
};

export const cartSessions = pgTable("cart_sessions", {
  id: uuid("id").primaryKey(),
  ipHash: varchar("ip_hash", { length: 64 }),
  items: jsonb("items").$type<CartSessionItem[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type CartOrderItemSnapshot = {
  projectId?: string;
  projectName?: LocalizedString | string;
  projectType?: "experience" | "product";
  styleName?: LocalizedString | string;
  date?: string;
  people?: number;
  price?: string;
};

export const cartOrderItems = pgTable("cart_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => cartOrders.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => diyProjects.id, {
    onDelete: "set null",
  }),
  styleId: uuid("style_id").references(() => projectStyles.id, {
    onDelete: "set null",
  }),
  projectName: jsonb("project_name").$type<LocalizedString | string>(),
  projectType: projectTypeEnum("project_type"),
  styleName: jsonb("style_name").$type<LocalizedString | string>(),
  date: varchar("date", { length: 32 }),
  people: integer("people"),
  price: varchar("price", { length: 32 }),
  priceCurrency: varchar("price_currency", { length: 10 }).notNull().default("AUD"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const requestRateLimits = pgTable(
  "request_rate_limits",
  {
    scope: varchar("scope", { length: 64 }).notNull(),
    subjectHash: varchar("subject_hash", { length: 64 }).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "request_rate_limits_pk",
      columns: [table.scope, table.subjectHash, table.windowStartedAt],
    }),
    check("request_rate_limits_count_positive", sql`${table.requestCount} >= 1`),
    index("request_rate_limits_expires_at_idx").on(table.expiresAt),
  ],
);

export const requestStatusEvents = pgTable(
  "request_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "restrict",
    }),
    cartOrderId: uuid("cart_order_id").references(() => cartOrders.id, {
      onDelete: "restrict",
    }),
    operationId: uuid("operation_id").notNull(),
    fromStatus: varchar("from_status", { length: 32 }).notNull(),
    toStatus: varchar("to_status", { length: 32 }).notNull(),
    adminNote: text("admin_note"),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("request_status_events_operation_id_unique").on(table.operationId),
    check(
      "request_status_events_exactly_one_request",
      sql`num_nonnulls(${table.bookingId}, ${table.cartOrderId}) = 1`,
    ),
  ],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dedupeKey: varchar("dedupe_key", { length: 255 }).notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "restrict",
    }),
    cartOrderId: uuid("cart_order_id").references(() => cartOrders.id, {
      onDelete: "restrict",
    }),
    statusEventId: uuid("status_event_id").references(() => requestStatusEvents.id, {
      onDelete: "restrict",
    }),
    messageType: varchar("message_type", { length: 64 }).notNull(),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    locale: varchar("locale", { length: 8 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    deliveryStatus: varchar("delivery_status", { length: 16 })
      .notNull()
      .default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_outbox_dedupe_key_unique").on(table.dedupeKey),
    check(
      "email_outbox_delivery_status_valid",
      sql`${table.deliveryStatus} IN ('pending', 'processing', 'sent', 'failed')`,
    ),
    check("email_outbox_attempt_count_nonnegative", sql`${table.attemptCount} >= 0`),
    index("email_outbox_delivery_due_idx").on(
      table.deliveryStatus,
      table.nextAttemptAt,
    ),
  ],
);

export const adminRequestReads = pgTable(
  "admin_request_reads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "cascade",
    }),
    cartOrderId: uuid("cart_order_id").references(() => cartOrders.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "admin_request_reads_exactly_one_request",
      sql`num_nonnulls(${table.bookingId}, ${table.cartOrderId}) = 1`,
    ),
    uniqueIndex("admin_request_reads_booking_unique")
      .on(table.userId, table.bookingId)
      .where(sql`${table.bookingId} IS NOT NULL`),
    uniqueIndex("admin_request_reads_cart_order_unique")
      .on(table.userId, table.cartOrderId)
      .where(sql`${table.cartOrderId} IS NOT NULL`),
  ],
);

export const siteSettings = pgTable("site_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeName: varchar("store_name", { length: 255 }).notNull(),
  address: text("address"),
  businessHours: varchar("business_hours", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 255 }),
  wechatId: varchar("wechat_id", { length: 128 }),
  wechatQrUrl: text("wechat_qr_url"),
  heroImageUrl: text("hero_image_url"),
  instagram: text("instagram"),
  xiaohongshu: text("xiaohongshu"),
  googleMapUrl: text("google_map_url"),
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
