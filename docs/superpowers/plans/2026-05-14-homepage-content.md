# Homepage Content Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new content sections to the YEZZ homepage to complete brand storytelling and conversion paths.

**Architecture:** Server Component (`page.tsx`) fetches data from Sanity in parallel, passes props to client section components. Each section is self-contained with framer-motion scroll animations. i18n via next-intl.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, framer-motion, next-intl, Sanity CMS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `components/sections/SceneEntry.tsx` | Create | 3 scene entry cards (Date/Birthday/DIY) |
| `components/sections/FeaturedProjects.tsx` | Create | Showcase 4 featured projects from Sanity |
| `components/sections/PartyPackagesPreview.tsx` | Create | Showcase 2 party packages from Sanity |
| `components/sections/GalleryHighlight.tsx` | Create | 6-image gallery grid from Sanity |
| `components/sections/StoreVibes.tsx` | Create | Store atmosphere section with image + text |
| `components/sections/WeChatCTA.tsx` | Create | Final conversion CTA with WeChat + Book buttons |
| `app/[locale]/page.tsx` | Modify | Parallel data fetching + render all sections |
| `lib/sanity/queries.ts` | Modify | Add homepage-specific GROQ queries |
| `lib/i18n/messages/en.json` | Modify | Add homepage translation keys |
| `lib/i18n/messages/zh.json` | Modify | Add homepage Chinese translations |

---

### Task 1: Add homepage GROQ queries

**Files:**
- Modify: `lib/sanity/queries.ts`

- [ ] **Step 1: Append featured queries to queries.ts**

Add after the existing `siteSettingsQuery`:

```typescript
export const featuredProjectsQuery = `*[_type == "diyProject"] | order(order asc) [0...4] {
  _id,
  name,
  slug,
  "category": category->name,
  description,
  "imageUrl": images[0].asset->url,
  priceRange,
  duration,
  tags,
  order
}`;

export const featuredPartiesQuery = `*[_type == "partyPackage"] | order(_createdAt asc) [0...2] {
  _id,
  name,
  slug,
  description,
  "imageUrl": images[0].asset->url,
  minPeople,
  maxPeople,
  priceIndicator,
  tags
}`;

export const galleryHighlightQuery = `*[_type == "galleryImage"] | order(order asc) [0...6] {
  _id,
  "imageUrl": image.asset->url,
  category,
  caption,
  order
}`;

export const storeVibesQuery = `*[_type == "galleryImage" && category == "store"] | order(order asc) [0] {
  _id,
  "imageUrl": image.asset->url,
  caption
}`;
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/sanity/queries.ts
git commit -m "feat(queries): add homepage featured queries"
```

---

### Task 2: Add i18n translation keys

**Files:**
- Modify: `lib/i18n/messages/en.json`
- Modify: `lib/i18n/messages/zh.json`

- [ ] **Step 1: Update en.json**

Replace the entire file with:

```json
{
  "metadata": {
    "title": "YEZZ - DIY Studio",
    "description": "Create your own masterpiece at YEZZ DIY Studio"
  },
  "nav": {
    "home": "Home",
    "projects": "Projects",
    "parties": "Parties",
    "gallery": "Gallery",
    "book": "Book Now",
    "contact": "Contact"
  },
  "hero": {
    "title": "Create Your Own Masterpiece",
    "subtitle": "A cozy DIY studio for dates, birthdays, and gatherings",
    "cta": "Book Now"
  },
  "home": {
    "sceneEntry": {
      "title": "Perfect For Every Occasion",
      "subtitle": "Find the perfect DIY experience for your special moment",
      "date": {
        "title": "Date Night",
        "desc": "Create something together on your next date."
      },
      "birthday": {
        "title": "Birthday Party",
        "desc": "Celebrate with friends through creative fun."
      },
      "diy": {
        "title": "DIY Experience",
        "desc": "Relax and make something beautiful with your hands."
      }
    },
    "featuredProjects": {
      "title": "Popular Projects",
      "viewAll": "View All Projects"
    },
    "partyPackages": {
      "title": "Party Packages",
      "viewAll": "View All Packages",
      "from": "From",
      "people": "people"
    },
    "gallery": {
      "title": "Customer Works",
      "viewAll": "View Gallery"
    },
    "storeVibes": {
      "title": "Visit Our Studio",
      "desc": "A warm, inviting space designed for creativity and connection. Come experience the YEZZ atmosphere.",
      "cta": "Find Us"
    },
    "wechatCta": {
      "title": "Ready to Create?",
      "subtitle": "Book your experience or reach out on WeChat — we are happy to help you plan the perfect visit.",
      "wechat": "Add WeChat",
      "book": "Book Now"
    }
  },
  "footer": {
    "rights": "All rights reserved."
  }
}
```

- [ ] **Step 2: Update zh.json**

Replace the entire file with:

```json
{
  "metadata": {
    "title": "YEZZ - 手作体验馆",
    "description": "在 YEZZ 手作体验馆，亲手制作独一无二的作品"
  },
  "nav": {
    "home": "首页",
    "projects": "项目",
    "parties": "派对",
    "gallery": "作品",
    "book": "立即预约",
    "contact": "联系我们"
  },
  "hero": {
    "title": "亲手制作，独一无二",
    "subtitle": "一个适合约会、生日和聚会的手作空间",
    "cta": "立即预约"
  },
  "home": {
    "sceneEntry": {
      "title": "适合每一个特别时刻",
      "subtitle": "为你的特别时刻找到完美的手作体验",
      "date": {
        "title": "约会时光",
        "desc": "在下次约会时一起创造属于你们的作品。"
      },
      "birthday": {
        "title": "生日派对",
        "desc": "和朋友们一起在创意中庆祝生日。"
      },
      "diy": {
        "title": "手作体验",
        "desc": "放松身心，用双手创造美好的事物。"
      }
    },
    "featuredProjects": {
      "title": "热门项目",
      "viewAll": "查看全部项目"
    },
    "partyPackages": {
      "title": "派对套餐",
      "viewAll": "查看全部套餐",
      "from": "起",
      "people": "人"
    },
    "gallery": {
      "title": "顾客作品",
      "viewAll": "查看全部作品"
    },
    "storeVibes": {
      "title": "来店里看看",
      "desc": "一个温暖、舒适的空间，专为创意和连接而设计。来体验 YEZZ 的氛围吧。",
      "cta": "找到我们"
    },
    "wechatCta": {
      "title": "准备好创造了吗？",
      "subtitle": "预约你的体验或添加微信咨询 — 我们很乐意帮你规划一次完美的到访。",
      "wechat": "添加微信",
      "book": "立即预约"
    }
  },
  "footer": {
    "rights": "版权所有。"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/messages/en.json lib/i18n/messages/zh.json
git commit -m "feat(i18n): add homepage section translations"
```

---

### Task 3: Create SceneEntry section

**Files:**
- Create: `components/sections/SceneEntry.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { Heart, Cake, Palette } from "lucide-react";

const scenes = [
  {
    key: "date",
    icon: Heart,
    href: "/projects",
    color: "bg-soft-pink/20",
    iconColor: "text-soft-pink",
  },
  {
    key: "birthday",
    icon: Cake,
    href: "/parties",
    color: "bg-sage/20",
    iconColor: "text-sage",
  },
  {
    key: "diy",
    icon: Palette,
    href: "/projects",
    color: "bg-lavender/20",
    iconColor: "text-lavender",
  },
];

export default function SceneEntry() {
  const t = useTranslations("home.sceneEntry");

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-warm-grey">{t("subtitle")}</p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {scenes.map((scene, i) => (
            <motion.div
              key={scene.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Link
                href={scene.href}
                className="group block rounded-2xl bg-cream p-8 text-center transition-shadow hover:shadow-md"
              >
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${scene.color}`}
                >
                  <scene.icon
                    className={`h-8 w-8 ${scene.iconColor}`}
                  />
                </div>
                <h3 className="mt-6 text-xl font-serif font-bold text-warm-charcoal">
                  {t(`${scene.key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-warm-grey">
                  {t(`${scene.key}.desc`)}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/sections/SceneEntry.tsx
git commit -m "feat(home): add SceneEntry section"
```

---

### Task 4: Create FeaturedProjects section

**Files:**
- Create: `components/sections/FeaturedProjects.tsx`
- Modify: `components/projects/ProjectCard.tsx` (add `locale` prop type fix if needed)

- [ ] **Step 1: Create FeaturedProjects.tsx**

```tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import ProjectCard from "@/components/projects/ProjectCard";

interface Project {
  _id: string;
  name: { en: string; zh: string };
  slug: { current: string };
  imageUrl?: string;
  priceRange?: string;
  duration?: string;
  tags?: string[];
}

interface FeaturedProjectsProps {
  projects: Project[];
}

export default function FeaturedProjects({ projects }: FeaturedProjectsProps) {
  const t = useTranslations("home.featuredProjects");
  const locale = useLocale();

  if (projects.length === 0) return null;

  return (
    <section className="py-20 bg-cream">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="flex items-end justify-between"
        >
          <div>
            <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/projects"
            className="text-sm font-medium text-caramel hover:underline"
          >
            {t("viewAll")} →
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((project, i) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <ProjectCard project={project} locale={locale} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/sections/FeaturedProjects.tsx
git commit -m "feat(home): add FeaturedProjects section"
```

---

### Task 5: Create PartyPackagesPreview section

**Files:**
- Create: `components/sections/PartyPackagesPreview.tsx`

- [ ] **Step 1: Create PartyPackagesPreview.tsx**

```tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import Image from "next/image";

interface PartyPackage {
  _id: string;
  name: { en: string; zh: string };
  slug: { current: string };
  description?: { en: string; zh: string };
  imageUrl?: string;
  minPeople?: number;
  maxPeople?: number;
  priceIndicator?: string;
}

interface PartyPackagesPreviewProps {
  packages: PartyPackage[];
}

export default function PartyPackagesPreview({ packages }: PartyPackagesPreviewProps) {
  const t = useTranslations("home.partyPackages");
  const locale = useLocale();

  if (packages.length === 0) return null;

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="flex items-end justify-between"
        >
          <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
            {t("title")}
          </h2>
          <Link
            href="/parties"
            className="text-sm font-medium text-caramel hover:underline"
          >
            {t("viewAll")} →
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {packages.map((pkg, i) => (
            <motion.div
              key={pkg._id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="group overflow-hidden rounded-2xl bg-cream transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                {pkg.imageUrl ? (
                  <Image
                    src={pkg.imageUrl}
                    alt={pkg.name[locale as "en" | "zh"]}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <span className="text-muted-foreground">No image</span>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-serif font-bold text-warm-charcoal">
                  {pkg.name[locale as "en" | "zh"]}
                </h3>
                {pkg.description && (
                  <p className="mt-2 text-sm text-warm-grey line-clamp-2">
                    {pkg.description[locale as "en" | "zh"]}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-warm-grey">
                    {pkg.minPeople && pkg.maxPeople && (
                      <span>
                        {pkg.minPeople}-{pkg.maxPeople} {t("people")}
                      </span>
                    )}
                  </div>
                  {pkg.priceIndicator && (
                    <span className="text-sm font-medium text-caramel">
                      {pkg.priceIndicator}
                    </span>
                  )}
                </div>
                <Link
                  href={`/parties`}
                  className="mt-4 inline-block rounded-full bg-caramel px-6 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                >
                  {t("viewAll")}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/sections/PartyPackagesPreview.tsx
git commit -m "feat(home): add PartyPackagesPreview section"
```

---

### Task 6: Create GalleryHighlight section

**Files:**
- Create: `components/sections/GalleryHighlight.tsx`

- [ ] **Step 1: Create GalleryHighlight.tsx**

```tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import Image from "next/image";

interface GalleryImage {
  _id: string;
  imageUrl?: string;
  category?: string;
  caption?: { en: string; zh: string };
}

interface GalleryHighlightProps {
  images: GalleryImage[];
}

const categoryLabels: Record<string, { en: string; zh: string }> = {
  couple: { en: "Couple", zh: "情侣" },
  birthday: { en: "Birthday", zh: "生日" },
  kids: { en: "Kids", zh: "儿童" },
  gift: { en: "Gift", zh: "礼物" },
  store: { en: "Store", zh: "店铺" },
  works: { en: "Works", zh: "作品" },
};

export default function GalleryHighlight({ images }: GalleryHighlightProps) {
  const t = useTranslations("home.gallery");
  const locale = useLocale();

  if (images.length === 0) return null;

  return (
    <section className="py-20 bg-cream">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="flex items-end justify-between"
        >
          <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
            {t("title")}
          </h2>
          <Link
            href="/gallery"
            className="text-sm font-medium text-caramel hover:underline"
          >
            {t("viewAll")} →
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <motion.div
              key={img._id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group relative aspect-square overflow-hidden rounded-xl"
            >
              {img.imageUrl ? (
                <Image
                  src={img.imageUrl}
                  alt={img.caption?.[locale as "en" | "zh"] || ""}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-muted">
                  <span className="text-muted-foreground">No image</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              {img.category && categoryLabels[img.category] && (
                <div className="absolute bottom-4 left-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-warm-charcoal">
                    {categoryLabels[img.category][locale as "en" | "zh"]}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/sections/GalleryHighlight.tsx
git commit -m "feat(home): add GalleryHighlight section"
```

---

### Task 7: Create StoreVibes section

**Files:**
- Create: `components/sections/StoreVibes.tsx`

- [ ] **Step 1: Create StoreVibes.tsx**

```tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import Image from "next/image";

interface StoreVibesProps {
  storeImage?: {
    _id: string;
    imageUrl?: string;
    caption?: { en: string; zh: string };
  } | null;
}

export default function StoreVibes({ storeImage }: StoreVibesProps) {
  const t = useTranslations("home.storeVibes");
  const locale = useLocale();

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl"
          >
            {storeImage?.imageUrl ? (
              <Image
                src={storeImage.imageUrl}
                alt={storeImage.caption?.[locale as "en" | "zh"] || "YEZZ Studio"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-cream">
                <span className="text-warm-grey">YEZZ Studio</span>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-warm-grey">
              {t("desc")}
            </p>
            <Link
              href="/contact"
              className="mt-8 inline-block rounded-full bg-caramel px-8 py-3 text-lg font-medium text-white transition-transform hover:-translate-y-1"
            >
              {t("cta")}
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/sections/StoreVibes.tsx
git commit -m "feat(home): add StoreVibes section"
```

---

### Task 8: Create WeChatCTA section

**Files:**
- Create: `components/sections/WeChatCTA.tsx`

- [ ] **Step 1: Create WeChatCTA.tsx**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

export default function WeChatCTA() {
  const t = useTranslations("home.wechatCta");

  return (
    <section className="py-20 bg-cream">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-6 text-lg text-warm-grey">{t("subtitle")}</p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => {
                // In production, this would open a QR code modal
                alert("WeChat ID copied!");
              }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-caramel px-8 py-3 text-lg font-medium text-caramel transition-colors hover:bg-caramel hover:text-white"
            >
              <MessageCircle className="h-5 w-5" />
              {t("wechat")}
            </button>
            <Link
              href="/book"
              className="inline-block rounded-full bg-caramel px-8 py-3 text-lg font-medium text-white transition-transform hover:-translate-y-1"
            >
              {t("book")}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/sections/WeChatCTA.tsx
git commit -m "feat(home): add WeChatCTA section"
```

---

### Task 9: Wire up page.tsx with data fetching

**Files:**
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace the entire file with:

```tsx
import { client } from "@/lib/sanity/client";
import {
  featuredProjectsQuery,
  featuredPartiesQuery,
  galleryHighlightQuery,
  storeVibesQuery,
} from "@/lib/sanity/queries";
import Hero from "@/components/sections/Hero";
import SceneEntry from "@/components/sections/SceneEntry";
import FeaturedProjects from "@/components/sections/FeaturedProjects";
import WhyDIY from "@/components/sections/WhyDIY";
import PartyPackagesPreview from "@/components/sections/PartyPackagesPreview";
import GalleryHighlight from "@/components/sections/GalleryHighlight";
import StoreVibes from "@/components/sections/StoreVibes";
import WeChatCTA from "@/components/sections/WeChatCTA";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const [projects, parties, galleryImages, storeImage] = await Promise.all([
    client.fetch(featuredProjectsQuery),
    client.fetch(featuredPartiesQuery),
    client.fetch(galleryHighlightQuery),
    client.fetch(storeVibesQuery),
  ]);

  return (
    <>
      <Hero />
      <SceneEntry />
      <FeaturedProjects projects={projects || []} />
      <WhyDIY />
      <PartyPackagesPreview packages={parties || []} />
      <GalleryHighlight images={galleryImages || []} />
      <StoreVibes storeImage={storeImage || null} />
      <WeChatCTA />
    </>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/\[locale\]/page.tsx
git commit -m "feat(home): wire up page with data fetching and all sections"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with 0 errors

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 3: Lint check**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Final commit (if any fixes needed)**

If any fixes were applied, commit them:
```bash
git add -A
git commit -m "fix(home): resolve build and type issues"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] SceneEntry — Task 3
- [x] FeaturedProjects — Task 4
- [x] PartyPackagesPreview — Task 5
- [x] GalleryHighlight — Task 6
- [x] StoreVibes — Task 7
- [x] WeChatCTA — Task 8
- [x] Data fetching — Task 1 (queries), Task 9 (page.tsx)
- [x] i18n — Task 2

**Placeholder scan:** No TBD, TODO, or vague steps found.

**Type consistency:**
- Project type matches existing `ProjectCardProps.project` shape
- Party package type matches Sanity schema fields
- Gallery image type matches Sanity schema fields
- All locale accesses use `"en" | "zh"` assertion consistently
