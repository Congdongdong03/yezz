import { loadEnv } from "./env.js";

loadEnv();
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  mockCategories,
  mockGalleryImages,
  mockParties,
  mockProjects,
} from "../../../apps/web/lib/mock-data.ts";
import { createDb } from "./client.js";
import {
  diyProjects,
  galleryImages,
  partyPackages,
  projectCategories,
  projectImages,
  projectStyles,
  siteSettings,
  users,
} from "./schema/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const { db, client } = createDb(databaseUrl);

type MockProject = (typeof mockProjects)[number];

function slugFromCurrent(slug: { current: string } | string): string {
  return typeof slug === "string" ? slug : slug.current;
}

function slugFromParty(slug: { current: string } | string): string {
  return typeof slug === "string" ? slug : slug.current;
}

function parsePriceRangeForSeed(priceRange: string | null | undefined) {
  if (!priceRange?.trim()) return { min: null as number | null, max: null as number | null };
  const numbers =
    priceRange.match(/\d+(?:\.\d+)?/g)?.map((n) => Number.parseFloat(n)) ?? [];
  if (numbers.length === 0) return { min: null, max: null };
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

async function clearSeedData() {
  await db.delete(projectImages);
  await db.delete(projectStyles);
  await db.delete(diyProjects);
  await db.delete(galleryImages);
  await db.delete(partyPackages);
  await db.delete(projectCategories);
  await db.delete(siteSettings);
  await db.delete(users);
}

async function seedSettingsIfEmpty() {
  const [settingsRow] = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1);
  if (!settingsRow) {
    await db.insert(siteSettings).values({
      storeName: "YEZZ DIY Studio",
      address: "上海市静安区创意路 88 号 YEZZ 工作室",
      businessHours: "每日 10:00 – 21:00",
      phone: "+86 138 0000 0000",
      email: "hello@yezz.studio",
      wechatId: "yezz_studio",
      wechatQrUrl: "https://picsum.photos/seed/yezz-wechat-qr/400/400",
      heroImageUrl: "https://picsum.photos/seed/yezz-hero/1920/1080",
      instagram: "https://instagram.com/yezzstudio",
      xiaohongshu: "https://xiaohongshu.com/user/yezz",
      googleMapUrl: "https://maps.google.com/?q=YEZZ+DIY+Studio",
      seoTitle: "YEZZ DIY Studio — Create Your Own Masterpiece",
      seoDescription:
        "A cozy DIY studio for dates, birthdays, and gatherings. Book your creative experience today.",
    });
    console.log("Seeded site settings");
  }
}

async function seedPartiesAndGalleryIfEmpty() {
  await seedSettingsIfEmpty();

  const [existingParty] = await db.select({ id: partyPackages.id }).from(partyPackages).limit(1);
  if (!existingParty) {
    let partyCount = 0;
    for (const [index, party] of mockParties.entries()) {
      const urls = party.images ?? (party.imageUrl ? [party.imageUrl] : []);
      await db.insert(partyPackages).values({
        name: party.name,
        slug: slugFromParty(party.slug),
        description: party.description ?? null,
        includes: party.includes ?? [],
        coverImageUrl: party.imageUrl ?? urls[0] ?? null,
        imageUrls: urls,
        minPeople: party.minPeople ?? 2,
        maxPeople: party.maxPeople ?? 20,
        priceIndicator: party.priceIndicator ?? null,
        tags: party.tags ?? null,
        sortOrder: index,
      });
      partyCount++;
    }
    console.log(`Seeded ${partyCount} party packages`);
  }

  const [existingGallery] = await db
    .select({ id: galleryImages.id })
    .from(galleryImages)
    .limit(1);
  if (!existingGallery) {
    let galleryCount = 0;
    for (const img of mockGalleryImages) {
      await db.insert(galleryImages).values({
        imageUrl: img.imageUrl,
        category: img.category,
        caption: img.caption ?? null,
        sortOrder: img.order ?? 0,
      });
      galleryCount++;
    }
    console.log(`Seeded ${galleryCount} gallery images`);
  }
}

async function seed() {
  const force = process.env.FORCE_SEED === "1";
  const [existing] = await db.select({ id: projectCategories.id }).from(projectCategories).limit(1);

  if (existing && !force) {
    console.log("Database already seeded (set FORCE_SEED=1 to re-run)");
    await seedPartiesAndGalleryIfEmpty();
    await client.end();
    return;
  }

  if (force) {
    console.log("FORCE_SEED=1 — clearing seed tables…");
    await clearSeedData();
  }

  const categoryIdBySlug = new Map<string, string>();

  for (const cat of mockCategories) {
    const slug = slugFromCurrent(cat.slug);
    const [row] = await db
      .insert(projectCategories)
      .values({
        name: cat.name,
        slug,
        description: cat.description ?? null,
        icon: cat.icon ?? null,
        sortOrder: cat.order ?? 0,
      })
      .returning({ id: projectCategories.id });

    categoryIdBySlug.set(slug, row.id);
  }

  console.log(`Seeded ${categoryIdBySlug.size} categories`);

  let projectCount = 0;
  let styleCount = 0;
  let imageCount = 0;

  for (const project of mockProjects as MockProject[]) {
    const categorySlug = slugFromCurrent(
      (project.category as { slug: { current: string } }).slug,
    );
    const categoryId = categoryIdBySlug.get(categorySlug);
    if (!categoryId) {
      console.warn(`Skipping project ${project._id}: unknown category ${categorySlug}`);
      continue;
    }

    const slug = slugFromCurrent(project.slug);
    const pricing = parsePriceRangeForSeed(project.priceRange ?? null);
    const [row] = await db
      .insert(diyProjects)
      .values({
        categoryId,
        name: project.name,
        slug,
        projectType: project.projectType as "experience" | "product",
        description: project.description ?? null,
        priceRange: project.priceRange ?? null,
        priceMin: pricing.min,
        priceMax: pricing.max,
        priceCurrency: "CNY",
        duration: project.duration ?? null,
        tags: project.tags ?? [],
        sortOrder: project.order ?? 0,
        coverImageUrl: project.imageUrl ?? null,
      })
      .returning({ id: diyProjects.id });

    projectCount++;

    const styles = project.styles ?? [];
    if (styles.length > 0) {
      await db.insert(projectStyles).values(
        styles.map((style, index) => ({
          projectId: row.id,
          name: style.name,
          imageUrl: style.imageUrl ?? null,
          price: style.price ?? null,
          sortOrder: index,
        })),
      );
      styleCount += styles.length;
    }

    const images = project.images ?? [];
    if (images.length > 0) {
      await db.insert(projectImages).values(
        images.map((url, index) => ({
          projectId: row.id,
          url,
          sortOrder: index,
        })),
      );
      imageCount += images.length;
    }
  }

  console.log(`Seeded ${projectCount} projects, ${styleCount} styles, ${imageCount} images`);

  await seedPartiesAndGalleryIfEmpty();

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@yezz.local").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme";
  const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      name: "YEZZ Admin",
      role: "admin",
    });
    console.log(`Seeded admin user: ${adminEmail}`);
  }

  await client.end();
  console.log("Seed completed");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
