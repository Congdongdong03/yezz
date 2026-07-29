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

export const projectTypeEnum = pgEnum("project_type", ["experience", "product"]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
]);

export type BookingStatus =
  | "pending_review"
  | "confirmed"
  | "waitlisted"
  | "rejected"
  | "time_proposed"
  | "awaiting_in_store_payment"
  | "confirmed_paid"
  | "payment_expired"
  | "reschedule_requested"
  | "cancellation_requested"
  | "cancelled"
  | "refunded"
  | "no_show"
  | "completed";

export type BookingChargeType =
  | "venue_fee"
  | "cake_cutting"
  | "cleaning"
  | "overtime"
  | "refund";

export type CustomerActionScope =
  | "accept_time"
  | "request_cancellation"
  | "request_reschedule";

export type UserRole = "owner" | "admin" | "staff";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 16 }).$type<UserRole>().notNull().default("staff"),
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("users_role_valid", sql`${table.role} IN ('owner', 'admin', 'staff')`),
  check("users_session_version_nonnegative", sql`${table.sessionVersion} >= 0`),
]);

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
  durationMinutes: integer("duration_minutes"),
  bookable: boolean("bookable").notNull().default(false),
  variantSelectedInStore: boolean("variant_selected_in_store").notNull().default(false),
  extraTimeMinutes: integer("extra_time_minutes"),
  extraTimePriceCents: integer("extra_time_price_cents"),
  tags: text("tags").array(),
  sortOrder: integer("sort_order").notNull().default(0),
  coverImageUrl: text("cover_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check(
    "diy_projects_cents_nonnegative",
    sql`(${table.priceMin} IS NULL OR ${table.priceMin} >= 0) AND (${table.priceMax} IS NULL OR ${table.priceMax} >= 0) AND (${table.extraTimePriceCents} IS NULL OR ${table.extraTimePriceCents} >= 0)`,
  ),
  check(
    "diy_projects_duration_positive",
    sql`(${table.durationMinutes} IS NULL OR ${table.durationMinutes} > 0) AND (${table.extraTimeMinutes} IS NULL OR ${table.extraTimeMinutes} > 0)`,
  ),
]);

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
  guestDurationMinutes: integer("guest_duration_minutes"),
  setupMinutes: integer("setup_minutes"),
  cleanupMinutes: integer("cleanup_minutes"),
  venueFeeCents: integer("venue_fee_cents"),
  minSpendPerPersonCents: integer("min_spend_per_person_cents"),
  minParents: integer("min_parents").notNull().default(1),
  maxParents: integer("max_parents").notNull().default(2),
  tags: text("tags").array(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check(
    "party_packages_cents_nonnegative",
    sql`(${table.venueFeeCents} IS NULL OR ${table.venueFeeCents} >= 0) AND (${table.minSpendPerPersonCents} IS NULL OR ${table.minSpendPerPersonCents} >= 0)`,
  ),
  check(
    "party_packages_duration_positive",
    sql`(${table.guestDurationMinutes} IS NULL OR ${table.guestDurationMinutes} > 0) AND (${table.setupMinutes} IS NULL OR ${table.setupMinutes} > 0) AND (${table.cleanupMinutes} IS NULL OR ${table.cleanupMinutes} > 0)`,
  ),
  check(
    "party_packages_parents_range",
    sql`${table.minParents} BETWEEN 1 AND 2 AND ${table.maxParents} BETWEEN ${table.minParents} AND 2`,
  ),
]);

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
  status: varchar("status", { length: 32 })
    .$type<BookingStatus>()
    .notNull()
    .default("pending_review"),
  participantCount: integer("participant_count"),
  youngChildCount: integer("young_child_count"),
  accompanyingAdultCount: integer("accompanying_adult_count"),
  attendanceCount: integer("attendance_count"),
  durationMinutes: integer("duration_minutes"),
  policyVersion: varchar("policy_version", { length: 32 }),
  policyAcceptedAt: timestamp("policy_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("bookings_idempotency_key_unique").on(table.idempotencyKey),
  check(
    "bookings_request_kind_valid",
    sql`${table.requestKind} IN ('experience', 'party')`,
  ),
  check(
    "bookings_kind_parent_consistent",
    sql`(${table.projectId} IS NULL AND ${table.partyPackageId} IS NULL) OR (${table.requestKind} = 'experience' AND ${table.projectId} IS NOT NULL AND ${table.partyPackageId} IS NULL) OR (${table.requestKind} = 'party' AND ${table.projectId} IS NULL AND ${table.partyPackageId} IS NOT NULL)`,
  ),
  check(
    "bookings_status_valid",
    sql`${table.status} IN ('pending_review', 'confirmed', 'waitlisted', 'rejected', 'time_proposed', 'awaiting_in_store_payment', 'confirmed_paid', 'payment_expired', 'reschedule_requested', 'cancellation_requested', 'cancelled', 'refunded', 'no_show', 'completed')`,
  ),
  check(
    "bookings_ordinary_attendance_range",
    sql`${table.requestKind} <> 'experience' OR ${table.attendanceCount} IS NULL OR ${table.attendanceCount} BETWEEN 1 AND 8`,
  ),
  check(
    "bookings_duration_positive",
    sql`${table.durationMinutes} IS NULL OR ${table.durationMinutes} > 0`,
  ),
]);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => diyProjects.id, {
      onDelete: "restrict",
    }),
    projectNameSnapshot: jsonb("project_name_snapshot").$type<LocalizedString>(),
    unitPriceCentsSnapshot: integer("unit_price_cents_snapshot"),
    durationMinutesSnapshot: integer("duration_minutes_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    decideInStore: boolean("decide_in_store").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    check(
      "booking_items_duration_positive",
      sql`${table.durationMinutesSnapshot} > 0`,
    ),
    check("booking_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "booking_items_unit_price_nonnegative",
      sql`${table.unitPriceCentsSnapshot} IS NULL OR ${table.unitPriceCentsSnapshot} >= 0`,
    ),
  ],
);

export const bookingPartyDetails = pgTable(
  "booking_party_details",
  {
    bookingId: uuid("booking_id")
      .primaryKey()
      .references(() => bookings.id, { onDelete: "cascade" }),
    birthdayChildName: varchar("birthday_child_name", { length: 255 }).notNull(),
    birthdayChildAge: integer("birthday_child_age").notNull(),
    participantCount: integer("participant_count").notNull(),
    parentCount: integer("parent_count").notNull(),
    desiredDate: date("desired_date").notNull(),
    desiredStartTime: varchar("desired_start_time", { length: 5 }).notNull(),
    byoCake: boolean("byo_cake").notNull().default(false),
    byoDrinks: boolean("byo_drinks").notNull().default(false),
    byoFood: boolean("byo_food").notNull().default(false),
    byoSnacks: boolean("byo_snacks").notNull().default(false),
    cakeCuttingRequested: boolean("cake_cutting_requested").notNull().default(false),
    specialRequirements: text("special_requirements"),
    finalDate: date("final_date"),
    finalSetupStart: varchar("final_setup_start", { length: 5 }),
    finalGuestStart: varchar("final_guest_start", { length: 5 }),
    finalGuestEnd: varchar("final_guest_end", { length: 5 }),
    finalCleanupEnd: varchar("final_cleanup_end", { length: 5 }),
    venueFeeCents: integer("venue_fee_cents").notNull(),
    minSpendPerPersonCents: integer("min_spend_per_person_cents").notNull(),
    paymentDeadline: timestamp("payment_deadline", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidAmountCents: integer("paid_amount_cents"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "booking_party_details_participants_range",
      sql`${table.participantCount} BETWEEN 4 AND 8`,
    ),
    check(
      "booking_party_details_parents_range",
      sql`${table.parentCount} BETWEEN 1 AND 2`,
    ),
    check(
      "booking_party_details_cents_nonnegative",
      sql`${table.venueFeeCents} >= 0 AND ${table.minSpendPerPersonCents} >= 0 AND (${table.paidAmountCents} IS NULL OR ${table.paidAmountCents} >= 0)`,
    ),
    check(
      "booking_party_details_time_format",
      sql`${table.desiredStartTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND (${table.finalSetupStart} IS NULL OR ${table.finalSetupStart} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$') AND (${table.finalGuestStart} IS NULL OR ${table.finalGuestStart} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$') AND (${table.finalGuestEnd} IS NULL OR ${table.finalGuestEnd} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$') AND (${table.finalCleanupEnd} IS NULL OR ${table.finalCleanupEnd} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')`,
    ),
  ],
);

export const bookingCharges = pgTable(
  "booking_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 24 }).$type<BookingChargeType>().notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("booking_charges_amount_nonnegative", sql`${table.amountCents} >= 0`),
    check(
      "booking_charges_type_valid",
      sql`${table.type} IN ('venue_fee', 'cake_cutting', 'cleaning', 'overtime', 'refund')`,
    ),
  ],
);

export const customerActionTokens = pgTable("customer_action_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
  scopes: text("scopes").array().$type<CustomerActionScope[]>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordSetupTokens = pgTable("password_setup_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studioWeeklyHours = pgTable(
  "studio_weekly_hours",
  {
    weekday: integer("weekday").primaryKey(),
    opensAt: varchar("opens_at", { length: 5 }).notNull(),
    closesAt: varchar("closes_at", { length: 5 }).notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
  },
  (table) => [
    check("studio_weekly_hours_weekday_range", sql`${table.weekday} BETWEEN 0 AND 6`),
    check(
      "studio_weekly_hours_time_format",
      sql`${table.opensAt} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.closesAt} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.opensAt} < ${table.closesAt}`,
    ),
  ],
);

export const studioSpecialHours = pgTable(
  "studio_special_hours",
  {
    date: date("date").primaryKey(),
    opensAt: varchar("opens_at", { length: 5 }),
    closesAt: varchar("closes_at", { length: 5 }),
    isClosed: boolean("is_closed").notNull().default(false),
    note: text("note"),
  },
  (table) => [
    check(
      "studio_special_hours_whole_day_closure",
      sql`(${table.isClosed} AND ${table.opensAt} IS NULL AND ${table.closesAt} IS NULL) OR (NOT ${table.isClosed} AND ${table.opensAt} IS NOT NULL AND ${table.closesAt} IS NOT NULL)`,
    ),
    check(
      "studio_special_hours_time_format",
      sql`${table.opensAt} IS NULL OR (${table.opensAt} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.closesAt} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.opensAt} < ${table.closesAt})`,
    ),
  ],
);

export const studioClosures = pgTable(
  "studio_closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),
    note: text("note"),
  },
  (table) => [
    check(
      "studio_closures_whole_day_null_pair",
      sql`(${table.startTime} IS NULL AND ${table.endTime} IS NULL) OR (${table.startTime} IS NOT NULL AND ${table.endTime} IS NOT NULL)`,
    ),
    check(
      "studio_closures_time_format",
      sql`${table.startTime} IS NULL OR (${table.startTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.endTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.startTime} < ${table.endTime})`,
    ),
  ],
);

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
  styleId?: string;
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
  styleId?: string;
  projectName?: LocalizedString | string;
  projectType?: "experience" | "product";
  styleName?: LocalizedString | string;
  date?: string;
  people?: number;
  price?: string;
  priceCurrency?: string;
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
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    actorKind: varchar("actor_kind", { length: 16 })
      .$type<"staff" | "customer" | "system">()
      .notNull()
      .default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("request_status_events_operation_id_unique").on(table.operationId),
    index("request_status_events_booking_id_idx").on(table.bookingId),
    index("request_status_events_cart_order_id_idx").on(table.cartOrderId),
    check(
      "request_status_events_exactly_one_request",
      sql`num_nonnulls(${table.bookingId}, ${table.cartOrderId}) = 1`,
    ),
    check(
      "request_status_events_from_status_valid",
      sql`${table.fromStatus} IN ('new', 'contacted', 'pending_review', 'confirmed', 'waitlisted', 'rejected', 'time_proposed', 'awaiting_in_store_payment', 'confirmed_paid', 'payment_expired', 'reschedule_requested', 'cancellation_requested', 'cancelled', 'refunded', 'no_show', 'completed')`,
    ),
    check(
      "request_status_events_to_status_valid",
      sql`${table.toStatus} IN ('new', 'contacted', 'pending_review', 'confirmed', 'waitlisted', 'rejected', 'time_proposed', 'awaiting_in_store_payment', 'confirmed_paid', 'payment_expired', 'reschedule_requested', 'cancellation_requested', 'cancelled', 'refunded', 'no_show', 'completed')`,
    ),
    check(
      "request_status_events_actor_kind_valid",
      sql`${table.actorKind} IN ('staff', 'customer', 'system')`,
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
    index("email_outbox_booking_id_idx").on(table.bookingId),
    index("email_outbox_cart_order_id_idx").on(table.cartOrderId),
    index("email_outbox_status_event_id_idx").on(table.statusEventId),
    check(
      "email_outbox_exactly_one_request",
      sql`num_nonnulls(${table.bookingId}, ${table.cartOrderId}) = 1`,
    ),
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
  experienceRequestsEnabled: boolean("experience_requests_enabled").notNull().default(false),
  partyRequestsEnabled: boolean("party_requests_enabled").notNull().default(false),
  productRequestsEnabled: boolean("product_requests_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
