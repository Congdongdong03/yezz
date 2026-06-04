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
