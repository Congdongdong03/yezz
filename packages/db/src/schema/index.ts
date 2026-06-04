import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export type LocalizedString = { en: string; zh: string };

export const userRoleEnum = pgEnum("user_role", ["admin"]);
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

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }).notNull(),
  wechat: varchar("wechat", { length: 128 }),
  email: varchar("email", { length: 255 }),
  preferredDate: varchar("preferred_date", { length: 32 }),
  numberOfPeople: integer("number_of_people"),
  activityType: varchar("activity_type", { length: 32 }),
  interestedProject: varchar("interested_project", { length: 255 }),
  message: text("message"),
  status: orderStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartOrders = pgTable("cart_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }).notNull(),
  wechat: varchar("wechat", { length: 128 }),
  message: text("message"),
  status: orderStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
  projectName: jsonb("project_name").$type<LocalizedString | string>(),
  projectType: projectTypeEnum("project_type"),
  styleName: jsonb("style_name").$type<LocalizedString | string>(),
  date: varchar("date", { length: 32 }),
  people: integer("people"),
  price: varchar("price", { length: 32 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

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
