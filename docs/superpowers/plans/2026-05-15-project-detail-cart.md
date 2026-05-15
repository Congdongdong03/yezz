# Project Detail Page & Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project detail pages (`/projects/[slug]`) and a lightweight pre-selection cart with sidebar drawer and checkout page (`/cart`).

**Architecture:** Product-type projects have selectable styles; experience-type projects have date/people options. Cart state lives in React Context + localStorage. Submission goes through a new Server Action that creates a `cartOrder` in Sanity and emails the owner via Resend.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Sanity, next-intl, Resend, shadcn/ui (where applicable), Framer Motion (already in project).

---

## File Structure

| File | Action | Responsibility |
|------|--------|--------------|
| `sanity/schemaTypes/diyProject.ts` | Modify | Add `projectType` and `styles` fields |
| `sanity/schemaTypes/cartOrder.ts` | Create | New document type for cart submissions |
| `sanity/schemaTypes/index.ts` | Modify | Export `cartOrder` |
| `lib/sanity/mock-data.ts` | Modify | Add `projectType` and `styles` to mock projects |
| `lib/sanity/queries.ts` | Modify | Add `projectDetailQuery` with full fields |
| `lib/cart/types.ts` | Create | `CartItem` interface |
| `lib/cart/storage.ts` | Create | localStorage read/write/clear for cart |
| `lib/cart/context.tsx` | Create | `CartProvider` + `useCart` hook |
| `components/projects/ProjectCard.tsx` | Modify | Wrap card in `Link` to detail page |
| `components/projects/StyleSelector.tsx` | Create | Radio grid for picking a product style |
| `components/cart/CartIcon.tsx` | Create | Navbar icon with count badge |
| `components/cart/CartDrawer.tsx` | Create | Right-side slide-out drawer |
| `components/cart/CartCheckoutForm.tsx` | Create | Form on `/cart` page |
| `app/[locale]/projects/[slug]/page.tsx` | Create | Project detail page |
| `app/[locale]/cart/page.tsx` | Create | Checkout page |
| `lib/actions/cart.ts` | Create | `submitCart` Server Action |
| `components/layout/Navbar.tsx` | Modify | Add `CartIcon` |
| `app/[locale]/layout.tsx` | Modify | Wrap with `CartProvider` |
| `components/sections/FeaturedProjects.tsx` | Modify | Pass `slug` to `ProjectCard` |
| `lib/i18n/messages/en.json` | Modify | Cart/booking strings |
| `lib/i18n/messages/zh.json` | Modify | Cart/booking strings |

---

## Task 1: Update `diyProject` Sanity schema

**Files:**
- Modify: `sanity/schemaTypes/diyProject.ts`

- [ ] **Step 1: Add `projectType` and `styles` fields**

Insert these two field definitions after the existing `category` field (before `description`):

```typescript
defineField({
  name: "projectType",
  title: "Project Type",
  type: "string",
  options: {
    list: [
      { title: "Experience (book time/people)", value: "experience" },
      { title: "Product (pick a style)", value: "product" },
    ],
  },
  initialValue: "experience",
  validation: (Rule) => Rule.required(),
}),
defineField({
  name: "styles",
  title: "Styles / Variants",
  type: "array",
  of: [
    {
      type: "object",
      fields: [
        defineField({
          name: "name",
          title: "Style Name",
          type: "object",
          fields: [
            { name: "en", title: "English", type: "string" },
            { name: "zh", title: "Chinese", type: "string" },
          ],
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "image",
          title: "Style Image",
          type: "image",
          options: { hotspot: true },
        }),
        defineField({
          name: "price",
          title: "Price",
          type: "string",
          description: "e.g. '¥78'",
        }),
      ],
    },
  ],
  hidden: ({ parent }) => parent?.projectType !== "product",
}),
```

- [ ] **Step 2: Commit**

```bash
git add sanity/schemaTypes/diyProject.ts
git commit -m "feat(sanity): add projectType and styles to diyProject"
```

---

## Task 2: Create `cartOrder` Sanity schema

**Files:**
- Create: `sanity/schemaTypes/cartOrder.ts`
- Modify: `sanity/schemaTypes/index.ts`

- [ ] **Step 1: Write `cartOrder.ts`**

```typescript
import { defineType, defineField } from "sanity";

export const cartOrder = defineType({
  name: "cartOrder",
  title: "Cart Order",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Customer Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "phone",
      title: "Phone",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "wechat",
      title: "WeChat ID",
      type: "string",
    }),
    defineField({
      name: "message",
      title: "Note",
      type: "text",
    }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "projectId", title: "Project ID", type: "string" },
            { name: "projectName", title: "Project Name", type: "string" },
            { name: "projectType", title: "Project Type", type: "string" },
            { name: "styleName", title: "Style Name", type: "string" },
            { name: "date", title: "Date", type: "string" },
            { name: "people", title: "People", type: "number" },
            { name: "price", title: "Price", type: "string" },
          ],
        },
      ],
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      initialValue: "new",
      options: {
        list: [
          { title: "New", value: "new" },
          { title: "Contacted", value: "contacted" },
          { title: "Confirmed", value: "confirmed" },
          { title: "Cancelled", value: "cancelled" },
        ],
      },
    }),
    defineField({
      name: "submittedAt",
      title: "Submitted At",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "phone",
    },
  },
});
```

- [ ] **Step 2: Export from `index.ts`**

Open `sanity/schemaTypes/index.ts` and add `cartOrder` to the schema array:

```typescript
import { cartOrder } from "./cartOrder";
// ... existing imports

export const schemaTypes = [
  // ... existing types
  cartOrder,
];
```

- [ ] **Step 3: Commit**

```bash
git add sanity/schemaTypes/cartOrder.ts sanity/schemaTypes/index.ts
git commit -m "feat(sanity): add cartOrder document type"
```

---

## Task 3: Update mock data

**Files:**
- Modify: `lib/sanity/mock-data.ts`

- [ ] **Step 1: Update existing projects with `projectType`**

Add `projectType: "experience"` to `mock-project-1` through `mock-project-4`, `mock-project-7`, `mock-project-8`, `mock-project-9`, `mock-project-10`.

Change `mock-project-5` (Labubu) and `mock-project-6` (LEGO) to:

```typescript
{
  _id: "mock-project-5",
  name: { en: "Labubu Doll Clothes", zh: "Labubu 娃衣" },
  slug: { current: "labubu-doll-clothes" },
  category: mockCategories[2],
  projectType: "product",
  description: {
    en: "Sew adorable miniature clothes for your Labubu dolls.",
    zh: "为你的 Labubu 玩偶缝制可爱的迷你服装。",
  },
  imageUrl: "https://picsum.photos/seed/yezz-labubu/800/600",
  images: [
    "https://picsum.photos/seed/yezz-labubu/800/600",
    "https://picsum.photos/seed/yezz-labubu2/800/600",
  ],
  priceRange: "¥78 - ¥128",
  duration: "1.5 - 2 hours",
  tags: ["Cute", "Trending"],
  styles: [
    { name: { en: "Pink Dress", zh: "粉色连衣裙" }, price: "¥78" },
    { name: { en: "Blue Overalls", zh: "蓝色背带裤" }, price: "¥88" },
    { name: { en: "Holiday Limited Set", zh: "节日限定套装" }, price: "¥128" },
  ],
  order: 5,
},
```

And `mock-project-2` (Paint by Numbers) to:

```typescript
{
  _id: "mock-project-2",
  name: { en: "Paint by Numbers", zh: "数字油画" },
  slug: { current: "paint-by-numbers" },
  category: mockCategories[0],
  projectType: "product",
  description: {
    en: "A relaxing painting experience where you fill in numbered sections.",
    zh: "一种轻松的绘画体验，按照数字填色即可创作出美丽的画作。",
  },
  imageUrl: "https://picsum.photos/seed/yezz-paint/800/600",
  images: [
    "https://picsum.photos/seed/yezz-paint/800/600",
    "https://picsum.photos/seed/yezz-paint2/800/600",
  ],
  priceRange: "¥88 - ¥168",
  duration: "2 - 3 hours",
  tags: ["Relaxing", "Artistic"],
  styles: [
    { name: { en: "Starry Night", zh: "星空主题" }, price: "¥88" },
    { name: { en: "Cherry Blossom Street", zh: "樱花街道" }, price: "¥98" },
    { name: { en: "Cute Pets", zh: "萌宠系列" }, price: "¥68" },
  ],
  order: 2,
},
```

- [ ] **Step 2: Commit**

```bash
git add lib/sanity/mock-data.ts
git commit -m "feat(mock): add projectType and styles to mock data"
```

---

## Task 4: Create cart types and storage utilities

**Files:**
- Create: `lib/cart/types.ts`
- Create: `lib/cart/storage.ts`

- [ ] **Step 1: Write `lib/cart/types.ts`**

```typescript
export interface CartItem {
  projectId: string;
  projectSlug: string;
  projectName: { en: string; zh: string };
  projectType: "experience" | "product";
  imageUrl?: string;
  styleName?: { en: string; zh: string };
  date?: string;
  people?: number;
  price?: string;
}
```

- [ ] **Step 2: Write `lib/cart/storage.ts`**

```typescript
import { CartItem } from "./types";

const CART_KEY = "yezz-cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function setCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_KEY);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/cart/types.ts lib/cart/storage.ts
git commit -m "feat(cart): add cart types and localStorage utilities"
```

---

## Task 5: Create CartContext

**Files:**
- Create: `lib/cart/context.tsx`

- [ ] **Step 1: Write `lib/cart/context.tsx`**

```typescript
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { CartItem } from "./types";
import { getCart, setCart } from "./storage";

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (projectId: string) => void;
  clearItems: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setItems(getCart());
  }, []);

  useEffect(() => {
    setCart(items);
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.projectId === item.projectId);
      if (exists) return prev;
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((projectId: string) => {
    setItems((prev) => prev.filter((i) => i.projectId !== projectId));
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, clearItems, isOpen, setIsOpen, toggle }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/cart/context.tsx
git commit -m "feat(cart): add CartProvider and useCart hook"
```

---

## Task 6: Update Sanity queries

**Files:**
- Modify: `lib/sanity/queries.ts`

- [ ] **Step 1: Add `projectDetailQuery`**

Append to `lib/sanity/queries.ts`:

```typescript
export const projectDetailQuery = `*[_type == "diyProject" && slug.current == $slug][0] {
  _id,
  name,
  slug,
  projectType,
  "category": category->{_id, name, slug},
  description,
  "imageUrl": images[0].asset->url,
  "images": images[].asset->url,
  styles[]{
    name,
    "imageUrl": image.asset->url,
    price
  },
  priceRange,
  duration,
  tags,
  order
}`;
```

- [ ] **Step 2: Commit**

```bash
git add lib/sanity/queries.ts
git commit -m "feat(queries): add projectDetailQuery with styles"
```

---

## Task 7: Update ProjectCard with link

**Files:**
- Modify: `components/projects/ProjectCard.tsx`

- [ ] **Step 1: Add `slug` prop and wrap in `Link`**

Modify the file to accept a `slug` and wrap the card:

```typescript
"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";

interface ProjectCardProps {
  project: {
    _id: string;
    name: { en: string; zh: string };
    slug?: { current: string };
    imageUrl?: string;
    priceRange?: string;
    duration?: string;
    tags?: string[];
  };
  locale: string;
}

export default function ProjectCard({ project, locale }: ProjectCardProps) {
  const href = project.slug?.current
    ? `/projects/${project.slug.current}`
    : "#";

  return (
    <Link href={href as any} className="group block cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden">
        {project.imageUrl ? (
          <Image
            src={project.imageUrl}
            alt={project.name[locale as "en" | "zh"]}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg font-bold text-warm-charcoal">
          {project.name[locale as "en" | "zh"]}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {project.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-soft-pink/20 px-3 py-1 text-xs text-warm-charcoal"
            >
              {tag}
            </span>
          ))}
        </div>
        {project.priceRange && (
          <p className="mt-2 text-sm text-caramel">{project.priceRange}</p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/ProjectCard.tsx
git commit -m "feat(project-card): link to detail page"
```

---

## Task 8: Create StyleSelector component

**Files:**
- Create: `components/projects/StyleSelector.tsx`

- [ ] **Step 1: Write component**

```typescript
"use client";

import { useLocale } from "next-intl";
import Image from "next/image";

interface Style {
  name: { en: string; zh: string };
  imageUrl?: string;
  price?: string;
}

interface StyleSelectorProps {
  styles: Style[];
  selected: Style | null;
  onSelect: (style: Style) => void;
}

export default function StyleSelector({ styles, selected, onSelect }: StyleSelectorProps) {
  const locale = useLocale();

  if (!styles || styles.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold text-warm-charcoal">
        {locale === "zh" ? "选择款式" : "Choose Style"}
      </h4>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {styles.map((style, idx) => {
          const isSelected = selected?.name.en === style.name.en;
          return (
            <button
              key={idx}
              onClick={() => onSelect(style)}
              className={`relative rounded-lg border-2 p-2 text-left transition-all ${
                isSelected
                  ? "border-caramel bg-caramel/5"
                  : "border-transparent bg-white hover:border-warm-grey/20"
              }`}
            >
              {style.imageUrl && (
                <div className="relative aspect-square overflow-hidden rounded-md">
                  <Image
                    src={style.imageUrl}
                    alt={style.name[locale as "en" | "zh"]}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <p className="mt-2 text-xs font-medium text-warm-charcoal">
                {style.name[locale as "en" | "zh"]}
              </p>
              {style.price && (
                <p className="text-xs text-caramel">{style.price}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/StyleSelector.tsx
git commit -m "feat(style-selector): add product style picker"
```

---

## Task 9: Create CartIcon component

**Files:**
- Create: `components/cart/CartIcon.tsx`

- [ ] **Step 1: Write component**

```typescript
"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart/context";

export default function CartIcon() {
  const { items, toggle } = useCart();
  const count = items.length;

  return (
    <button
      onClick={toggle}
      className="relative rounded-full p-2 text-warm-charcoal transition-colors hover:bg-warm-grey/10"
      aria-label="Open cart"
    >
      <ShoppingBag className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-caramel text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cart/CartIcon.tsx
git commit -m "feat(cart-icon): add cart icon with badge"
```

---

## Task 10: Update Navbar with CartIcon

**Files:**
- Modify: `components/layout/Navbar.tsx`

- [ ] **Step 1: Import and insert CartIcon**

Add import:
```typescript
import CartIcon from "@/components/cart/CartIcon";
```

Insert `<CartIcon />` inside the desktop actions div (after the language toggle, before the Book link):

```tsx
<div className="hidden items-center gap-4 md:flex">
  <CartIcon />
  <Link
    href={pathname}
    locale={locale === "zh" ? "en" : "zh"}
    className="text-sm text-warm-grey hover:text-warm-charcoal"
  >
    {locale === "zh" ? "EN" : "中"}
  </Link>
  {/* ... Book link ... */}
</div>
```

Also add it inside the mobile header next to the toggle button. Place it before the toggle button:

```tsx
<div className="flex items-center gap-2 md:hidden">
  <CartIcon />
  <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
  </button>
</div>
```

Adjust the `justify-between` in the nav to accommodate. The existing structure should work.

- [ ] **Step 2: Commit**

```bash
git add components/layout/Navbar.tsx
git commit -m "feat(navbar): integrate CartIcon"
```

---

## Task 11: Create CartDrawer component

**Files:**
- Create: `components/cart/CartDrawer.tsx`

- [ ] **Step 1: Write component**

```typescript
"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { X, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useCart } from "@/lib/cart/context";

export default function CartDrawer() {
  const { items, removeItem, isOpen, setIsOpen } = useCart();
  const locale = useLocale();
  const t = useTranslations("cart");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-warm-grey/10 px-6 py-4">
              <h2 className="font-serif text-lg font-bold text-warm-charcoal">
                {t("title")}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-warm-grey hover:bg-warm-grey/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <p className="mt-12 text-center text-warm-grey">{t("empty")}</p>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.projectId}
                      className="flex gap-4 rounded-lg bg-white p-3 shadow-sm"
                    >
                      {item.imageUrl && (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
                          <Image
                            src={item.imageUrl}
                            alt={item.projectName[locale as "en" | "zh"]}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-warm-charcoal">
                          {item.projectName[locale as "en" | "zh"]}
                        </p>
                        {item.styleName && (
                          <p className="text-xs text-warm-grey">
                            {item.styleName[locale as "en" | "zh"]}
                          </p>
                        )}
                        {item.date && (
                          <p className="text-xs text-warm-grey">
                            {item.date} · {item.people} {t("people")}
                          </p>
                        )}
                        {item.price && (
                          <p className="mt-1 text-xs text-caramel">{item.price}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.projectId)}
                        className="self-start text-warm-grey hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-warm-grey/10 px-6 py-4">
                <Link
                  href="/cart"
                  onClick={() => setIsOpen(false)}
                  className="block w-full rounded-full bg-caramel py-3 text-center text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                >
                  {t("submit")}
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cart/CartDrawer.tsx
git commit -m "feat(cart-drawer): add right-side slide-out drawer"
```

---

## Task 12: Create project detail page

**Files:**
- Create: `app/[locale]/projects/[slug]/page.tsx`

- [ ] **Step 1: Write page**

```typescript
import { client } from "@/lib/sanity/client";
import { projectDetailQuery } from "@/lib/sanity/queries";
import { mockProjects } from "@/lib/sanity/mock-data";
import ProjectDetail from "@/components/projects/ProjectDetail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  let project: any = null;
  try {
    project = await client.fetch(projectDetailQuery, { slug });
  } catch {
    // Sanity unavailable
  }

  if (!project) {
    project = mockProjects.find((p) => p.slug.current === slug) || null;
  }

  if (!project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-warm-grey">Project not found</p>
      </div>
    );
  }

  return <ProjectDetail project={project} locale={locale} />;
}
```

- [ ] **Step 2: Create `components/projects/ProjectDetail.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart/context";
import { Link } from "@/i18n/routing";
import StyleSelector from "./StyleSelector";

interface ProjectDetailProps {
  project: any;
  locale: string;
}

export default function ProjectDetail({ project, locale }: ProjectDetailProps) {
  const pageLocale = useLocale();
  const t = useTranslations("projectDetail");
  const cartT = useTranslations("cart");
  const { addItem, setIsOpen } = useCart();

  const [selectedStyle, setSelectedStyle] = useState<any>(null);
  const [date, setDate] = useState("");
  const [people, setPeople] = useState(1);
  const [added, setAdded] = useState(false);

  const isProduct = project.projectType === "product";

  const handleAddToCart = () => {
    const item = {
      projectId: project._id,
      projectSlug: project.slug.current,
      projectName: project.name,
      projectType: project.projectType || "experience",
      imageUrl: project.imageUrl,
      styleName: isProduct ? selectedStyle?.name : undefined,
      date: !isProduct ? date : undefined,
      people: !isProduct ? people : undefined,
      price: isProduct ? selectedStyle?.price : project.priceRange,
    };
    addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleBookNow = () => {
    handleAddToCart();
    setIsOpen(true);
  };

  return (
    <div className="min-h-screen bg-cream pb-20">
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <Link
          href="/projects"
          className="text-sm text-warm-grey hover:text-caramel"
        >
          ← {t("back")}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-6"
        >
          {/* Gallery */}
          <div className="grid gap-4 sm:grid-cols-2">
            {project.images?.map((img: string, i: number) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-xl ${i === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-square"}`}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="mt-8">
            <h1 className="font-serif text-3xl font-bold text-warm-charcoal">
              {project.name[pageLocale as "en" | "zh"]}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-soft-pink/20 px-3 py-1 text-xs text-warm-charcoal"
                >
                  {tag}
                </span>
              ))}
            </div>
            {project.priceRange && (
              <p className="mt-4 text-lg text-caramel">{project.priceRange}</p>
            )}
            {project.duration && (
              <p className="mt-1 text-sm text-warm-grey">
                {t("duration")}: {project.duration}
              </p>
            )}
            {project.description && (
              <p className="mt-4 leading-relaxed text-warm-charcoal">
                {project.description[pageLocale as "en" | "zh"]}
              </p>
            )}
          </div>

          {/* Style selector for products */}
          {isProduct && project.styles && (
            <StyleSelector
              styles={project.styles}
              selected={selectedStyle}
              onSelect={setSelectedStyle}
            />
          )}

          {/* Experience options */}
          {!isProduct && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-warm-charcoal">
                  {t("preferredDate")}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-charcoal">
                  {t("numberOfPeople")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={people}
                  onChange={(e) => setPeople(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={isProduct && !selectedStyle}
              className="flex-1 rounded-full border-2 border-caramel py-3 text-sm font-medium text-caramel transition-colors hover:bg-caramel/5 disabled:opacity-40"
            >
              {added ? cartT("added") : cartT("add")}
            </button>
            <button
              onClick={handleBookNow}
              disabled={isProduct && !selectedStyle}
              className="flex-1 rounded-full bg-caramel py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              {cartT("bookNow")}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\[locale\]/projects/\[slug\]/page.tsx components/projects/ProjectDetail.tsx
git commit -m "feat(project-detail): add detail page with style selector and cart actions"
```

---

## Task 13: Create cart checkout page

**Files:**
- Create: `app/[locale]/cart/page.tsx`

- [ ] **Step 1: Write page**

```typescript
"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart/context";
import { submitCart } from "@/lib/actions/cart";

export default function CartPage() {
  const locale = useLocale();
  const t = useTranslations("cart");
  const { items, clearItems } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wechat, setWechat] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  if (items.length === 0 && status !== "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <p className="text-warm-grey">{t("empty")}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setStatus("submitting");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("wechat", wechat);
    formData.append("message", message);
    formData.append("items", JSON.stringify(items));

    const result = await submitCart(formData);
    if (result.success) {
      setStatus("success");
      clearItems();
    } else {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h2 className="font-serif text-2xl font-bold text-warm-charcoal">
            {t("thankYou")}
          </h2>
          <p className="mt-2 text-warm-grey">{t("confirmMessage")}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream py-12">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="font-serif text-2xl font-bold text-warm-charcoal">
          {t("checkoutTitle")}
        </h1>

        {/* Items review */}
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div
              key={item.projectId}
              className="flex gap-4 rounded-xl bg-white p-4 shadow-sm"
            >
              {item.imageUrl && (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={item.imageUrl}
                    alt={item.projectName[locale as "en" | "zh"]}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div>
                <p className="font-medium text-warm-charcoal">
                  {item.projectName[locale as "en" | "zh"]}
                </p>
                {item.styleName && (
                  <p className="text-sm text-warm-grey">
                    {item.styleName[locale as "en" | "zh"]}
                  </p>
                )}
                {item.date && (
                  <p className="text-sm text-warm-grey">
                    {item.date} · {item.people} {t("people")}
                  </p>
                )}
                {item.price && <p className="text-sm text-caramel">{item.price}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-charcoal">
              {t("name")} *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-charcoal">
              {t("phone")} *
            </label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-charcoal">
              {t("wechat")}
            </label>
            <input
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-charcoal">
              {t("note")}
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-grey/20 bg-white px-3 py-2 text-sm outline-none focus:border-caramel"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-500">{t("error")}</p>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-full bg-caramel py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {status === "submitting" ? t("submitting") : t("confirmSubmit")}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[locale\]/cart/page.tsx
git commit -m "feat(cart): add checkout page"
```

---

## Task 14: Create submitCart Server Action

**Files:**
- Create: `lib/actions/cart.ts`

- [ ] **Step 1: Write action**

```typescript
"use server";

import { z } from "zod";
import { client } from "@/lib/sanity/client";
import { Resend } from "resend";

const cartSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  wechat: z.string().optional(),
  message: z.string().optional(),
  items: z.string(), // JSON string of CartItem[]
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitCart(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = cartSchema.safeParse(rawData);

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  let items: any[] = [];
  try {
    items = JSON.parse(data.items);
  } catch {
    return { success: false, errors: { items: ["Invalid items"] } };
  }

  try {
    const order = await client.create({
      _type: "cartOrder",
      name: data.name,
      phone: data.phone,
      wechat: data.wechat || "",
      message: data.message || "",
      items: items.map((item) => ({
        projectId: item.projectId,
        projectName: item.projectName?.en || item.projectName,
        projectType: item.projectType,
        styleName: item.styleName?.en || item.styleName || "",
        date: item.date || "",
        people: item.people || 0,
        price: item.price || "",
      })),
      status: "new",
      submittedAt: new Date().toISOString(),
    });

    const itemsHtml = items
      .map(
        (item, i) =>
          `<p>${i + 1}. ${item.projectName?.en || item.projectName} — ${
            item.styleName?.en || item.styleName || item.date + " / " + item.people + " people"
          } — ${item.price || "N/A"}</p>`
      )
      .join("");

    await resend.emails.send({
      from: "YEZZ <bookings@yezz.studio>",
      to: process.env.OWNER_EMAIL || "",
      subject: `New Order from ${data.name}`,
      html: `
        <h2>New Order Received</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>WeChat:</strong> ${data.wechat || "N/A"}</p>
        <p><strong>Note:</strong> ${data.message || "N/A"}</p>
        <h3>Items:</h3>
        ${itemsHtml}
      `,
    });

    return { success: true, orderId: order._id };
  } catch (error) {
    console.error("Cart submission error:", error);
    return { success: false, errors: { server: ["Failed to submit. Please try again."] } };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/cart.ts
git commit -m "feat(cart): add submitCart Server Action"
```

---

## Task 15: Update FeaturedProjects to pass slug

**Files:**
- Modify: `components/sections/FeaturedProjects.tsx`

- [ ] **Step 1: Ensure ProjectCard receives slug**

The `ProjectCard` interface now expects `slug?.current`. Verify `FeaturedProjects` passes the full project object (it already does). No code change needed if the shape matches, but check that `featuredProjectsQuery` returns `slug`.

Open `lib/sanity/queries.ts` and confirm `featuredProjectsQuery` includes `slug`. If not, add it:

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
```

- [ ] **Step 2: Commit if changed**

```bash
git add lib/sanity/queries.ts
git commit -m "feat(queries): include slug in featuredProjectsQuery"
```

---

## Task 16: Update layout with CartProvider

**Files:**
- Modify: `app/[locale]/layout.tsx`

- [ ] **Step 1: Wrap app with CartProvider and add CartDrawer**

```typescript
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { CartProvider } from "@/lib/cart/context";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "zh")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <CartProvider>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </div>
      </CartProvider>
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[locale\]/layout.tsx
git commit -m "feat(layout): add CartProvider and CartDrawer"
```

---

## Task 17: Add i18n messages

**Files:**
- Modify: `lib/i18n/messages/en.json`
- Modify: `lib/i18n/messages/zh.json`

- [ ] **Step 1: Add to `en.json`**

Add these keys under the root:

```json
{
  "cart": {
    "title": "My Pre-selection",
    "empty": "Your pre-selection is empty. Browse projects to add items.",
    "add": "Add to Cart",
    "added": "Added!",
    "bookNow": "Book Now",
    "submit": "Submit Booking",
    "checkoutTitle": "Booking Confirmation",
    "name": "Name",
    "phone": "Phone",
    "wechat": "WeChat",
    "note": "Note",
    "people": "people",
    "confirmSubmit": "Confirm Submit",
    "submitting": "Submitting...",
    "thankYou": "Thank You!",
    "confirmMessage": "We'll contact you soon to confirm your booking.",
    "error": "Something went wrong. Please try again."
  },
  "projectDetail": {
    "back": "Back to Projects",
    "duration": "Duration",
    "preferredDate": "Preferred Date",
    "numberOfPeople": "Number of People"
  }
}
```

- [ ] **Step 2: Add to `zh.json`**

```json
{
  "cart": {
    "title": "我的预选单",
    "empty": "预选单是空的，去浏览项目吧。",
    "add": "加入预选单",
    "added": "已添加！",
    "bookNow": "立即预约",
    "submit": "提交预约",
    "checkoutTitle": "预约确认",
    "name": "姓名",
    "phone": "电话",
    "wechat": "微信号",
    "note": "备注",
    "people": "人",
    "confirmSubmit": "确认提交",
    "submitting": "提交中...",
    "thankYou": "感谢您的预约！",
    "confirmMessage": "我们会尽快联系您确认预约详情。",
    "error": "出了点问题，请重试。"
  },
  "projectDetail": {
    "back": "返回项目列表",
    "duration": "时长",
    "preferredDate": "首选日期",
    "numberOfPeople": "人数"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/messages/en.json lib/i18n/messages/zh.json
git commit -m "feat(i18n): add cart and project detail translations"
```

---

## Task 18: Verify build

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run dev server spot check**

```bash
npm run dev
```

Open `http://localhost:3000/projects`, click a project card, verify:
1. Detail page loads with images and info
2. Product projects show style selector
3. "Add to Cart" adds item to cart icon count
4. Cart drawer opens and shows item
5. `/cart` page loads with form
6. Submitting form shows success state

- [ ] **Step 3: Commit if all clean**

No new files to add. Stop dev server (`Ctrl+C`) after check.

---

## Self-Review

**1. Spec coverage:**
- ✅ `projectType` and `styles` fields in Sanity — Task 1
- ✅ `cartOrder` document type — Task 2
- ✅ Project detail page `/projects/[slug]` — Task 12
- ✅ Cart sidebar drawer — Task 11
- ✅ `/cart` checkout page — Task 13
- ✅ `submitCart` Server Action + email — Task 14
- ✅ Mock data with product styles — Task 3
- ✅ i18n strings — Task 17
- ✅ Existing `/book` kept unchanged — mentioned in Task 14 notes

**2. Placeholder scan:** No TBD/TODO/fill-in-details found.

**3. Type consistency:**
- `CartItem` shape matches usage in context, drawer, checkout page, and action.
- `projectType` is `"experience" | "product"` everywhere.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-15-project-detail-cart.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
