# YezYY Customer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace demo identity and ambiguous checkout wording with YezYY's real Melbourne business identity, AUD pricing, manual-confirmation booking language, and professional empty catalogue states.

**Architecture:** Keep the existing Next.js/Fastify/Drizzle structure. Centralise approved fallback business data in a small web module, keep editable live values in the existing settings record, and update public copy and email templates to describe a pending request followed by manual confirmation.

**Tech Stack:** Next.js 16, React 19, next-intl, Fastify 5, Drizzle ORM, PostgreSQL, Vitest, Playwright.

## Global Constraints

- Public brand spelling and casing is exactly `YezYY`.
- Canonical public origin is exactly `https://yezyy.com`.
- Internal `@yezz/*` package names, database table names, migrations, and repository name remain unchanged.
- Public site remains English and Chinese; admin remains Chinese.
- Currency defaults to `AUD`; online payment is not offered; customers pay in store.
- A submitted request remains pending until a Chinese-admin user confirms it.
- No fictional projects or AI-generated project photographs are published.

---

### Task 1: Canonical Business Profile and AUD Pricing

**Files:**
- Create: `apps/web/lib/site/business.ts`
- Create: `apps/web/lib/site/business.test.ts`
- Modify: `apps/web/lib/site/data.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/seed.ts`
- Modify: `apps/api/src/services/admin/settings.admin.service.ts`
- Modify: `apps/api/src/lib/pricing.ts`
- Modify: `apps/api/src/lib/pricing.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `YEZYY_BUSINESS_PROFILE`, `formatPhoneHref(phone: string): string`, and `formatBusinessHours(locale: "en" | "zh"): string`.
- Produces: pricing functions whose omitted currency defaults to `AUD` while explicit `CNY` remains supported.
- Consumed by: public metadata, contact/footer components, seed settings, and admin settings fallbacks.

- [ ] **Step 1: Add failing AUD pricing tests**

```ts
it("defaults a numeric range to AUD", () => {
  expect(formatPriceDisplay({ min: 45, max: 65 })).toBe("$45–$65");
});

it("defaults a project without a currency to AUD", () => {
  expect(
    formatProjectPricing({
      priceMin: 45,
      priceMax: 45,
      priceRange: null,
      priceCurrency: null,
    }).priceDisplay,
  ).toBe("$45");
});
```

- [ ] **Step 2: Run the focused API test and verify RED**

Run: `corepack pnpm --filter @yezz/api test -- src/lib/pricing.test.ts`

Expected: FAIL because the current omitted currency is `CNY` and produces `¥`.

- [ ] **Step 3: Add failing business-profile tests**

```ts
import {
  YEZYY_BUSINESS_PROFILE,
  formatBusinessHours,
  formatPhoneHref,
} from "./business";

it("contains the approved public identity", () => {
  expect(YEZYY_BUSINESS_PROFILE).toMatchObject({
    storeName: "YezYY",
    address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
    phone: "0430 787 712",
    email: "izzybella.chen@gmail.com",
    xiaohongshu: "95848743904",
    currency: "AUD",
  });
});

it("creates a dialable Australian phone link", () => {
  expect(formatPhoneHref("0430 787 712")).toBe("0430787712");
});

it("formats the confirmed Thursday closing time", () => {
  expect(formatBusinessHours("en")).toContain("Thursday: 9:30 am–8:30 pm");
  expect(formatBusinessHours("zh")).toContain("星期四：上午9:30–晚上8:30");
});
```

- [ ] **Step 4: Run the focused web test and verify RED**

Run: `corepack pnpm --filter @yezz/web test -- lib/site/business.test.ts`

Expected: FAIL because the web package has no test script and `business.ts` does not exist.

- [ ] **Step 5: Implement the minimal business profile and AUD defaults**

```ts
export const YEZYY_BUSINESS_PROFILE = {
  storeName: "YezYY",
  website: "https://yezyy.com",
  address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
  phone: "0430 787 712",
  email: "izzybella.chen@gmail.com",
  xiaohongshu: "95848743904",
  currency: "AUD",
  googleMapUrl:
    "https://www.google.com/maps/search/?api=1&query=G082%2F235%20Springvale%20Rd%2C%20Glen%20Waverley%20VIC%203150",
} as const;

export function formatPhoneHref(phone: string) {
  return phone.replace(/\D/g, "");
}
```

Add `vitest` and `"test": "vitest run"` to `@yezz/web`. Change active schema, seed, admin fallback, and pricing defaults from `CNY` to `AUD`, without rewriting historical migrations.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/lib/pricing.test.ts
corepack pnpm --filter @yezz/web test -- lib/site/business.test.ts
```

Expected: both focused suites pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/site/business.ts apps/web/lib/site/business.test.ts apps/web/lib/site/data.ts apps/web/package.json pnpm-lock.yaml packages/db/src/schema/index.ts packages/db/src/seed.ts apps/api/src/services/admin/settings.admin.service.ts apps/api/src/lib/pricing.ts apps/api/src/lib/pricing.test.ts
git commit -m "feat: configure YezYY Melbourne business profile"
```

### Task 2: Public Brand, Contact Details, and Empty Catalogue States

**Files:**
- Create: `apps/web/components/EmptyCatalogueState.tsx`
- Modify: `apps/web/components/layout/Navbar.tsx`
- Modify: `apps/web/components/layout/Footer.tsx`
- Modify: `apps/web/components/sections/Hero.tsx`
- Modify: `apps/web/components/sections/StoreVibes.tsx`
- Modify: `apps/web/app/[locale]/contact/page.tsx`
- Modify: `apps/web/app/[locale]/projects/page.tsx`
- Modify: `apps/web/app/[locale]/parties/page.tsx`
- Modify: `apps/web/app/[locale]/gallery/page.tsx`
- Modify: `apps/web/app/[locale]/page.tsx`
- Modify: `apps/web/app/admin/layout.tsx`
- Modify: `apps/web/app/admin/login/page.tsx`
- Modify: `apps/web/components/admin/AdminShell.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`
- Modify: `apps/web/lib/site/metadata.ts`
- Modify: `apps/api/src/plugins/swagger.ts`
- Modify: `README.md`
- Modify: `docs/production-config-checklist.md`
- Test: `apps/web/lib/site/business.test.ts`

**Interfaces:**
- Consumes: `YEZYY_BUSINESS_PROFILE` and `formatPhoneHref`.
- Produces: `EmptyCatalogueState({ locale, kind, phone, email })`, rendered whenever a successful API response contains no publishable content.

- [ ] **Step 1: Add a failing empty-state view-model test**

Add a pure `getEmptyCatalogueCopy(locale, kind)` export to the expected interface:

```ts
expect(getEmptyCatalogueCopy("en", "projects")).toEqual({
  title: "Our project menu is being prepared",
  body: "YezYY is open. Call or email us to ask about current DIY experiences.",
});
expect(getEmptyCatalogueCopy("zh", "gallery").title).toBe("作品照片正在整理中");
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @yezz/web test -- lib/site/business.test.ts`

Expected: FAIL because `getEmptyCatalogueCopy` is not exported.

- [ ] **Step 3: Implement the shared empty state and replace public demo identity**

```tsx
export function EmptyCatalogueState({
  title,
  body,
  phone,
  email,
}: {
  title: string;
  body: string;
  phone: string;
  email: string;
}) {
  return (
    <section className="mx-auto my-12 max-w-2xl rounded-2xl border border-warm-grey/15 bg-white p-8 text-center">
      <h2 className="font-serif text-2xl font-semibold text-warm-charcoal">{title}</h2>
      <p className="mt-3 text-warm-grey">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href={`tel:${formatPhoneHref(phone)}`}>{phone}</a>
        <a href={`mailto:${email}`}>{email}</a>
      </div>
    </section>
  );
}
```

Use `YezYY` in customer/admin visible branding. Make contact links clickable. Render approved address, hours, phone, email, Xiaohongshu ID, and map; hide WeChat/Instagram/QR when absent. Render the shared empty state instead of blank grids. When no hero image exists, use the existing cream/pink brand palette as a compact CSS background rather than leaving a full-screen blank image area. Do not add fake projects or images. Replace active `yezz.studio` examples in the README and production configuration guide with `yezyy.com`.

- [ ] **Step 4: Verify GREEN and lint the touched public surface**

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/site/business.test.ts
corepack pnpm --filter @yezz/web exec eslint components/EmptyCatalogueState.tsx components/layout/Navbar.tsx components/layout/Footer.tsx app/[locale]/contact/page.tsx app/[locale]/projects/page.tsx app/[locale]/parties/page.tsx app/[locale]/gallery/page.tsx
```

Expected: focused tests and lint pass.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/production-config-checklist.md apps/web/components/EmptyCatalogueState.tsx apps/web/components/layout apps/web/components/sections apps/web/app/[locale] apps/web/app/admin/layout.tsx apps/web/app/admin/login/page.tsx apps/web/components/admin/AdminShell.tsx apps/web/lib/i18n apps/web/lib/site/metadata.ts apps/api/src/plugins/swagger.ts
git commit -m "feat: publish YezYY identity and honest empty states"
```

### Task 3: Pending Booking Request and Pay-in-Store Language

**Files:**
- Modify: `apps/api/src/lib/email.ts`
- Modify: `apps/api/src/lib/email.test.ts`
- Modify: `.env.example`
- Modify: `docs/production-config-checklist.md`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`
- Modify: `apps/web/app/[locale]/cart/page.tsx`
- Modify: `apps/web/components/book/BookingForm.tsx`
- Modify: `apps/web/components/book/BookingCalendar.tsx`
- Modify: `apps/web/components/projects/ProjectDetail.tsx`
- Modify: `apps/web/e2e/booking.spec.ts`
- Modify: `apps/web/e2e/cart.spec.ts`

**Interfaces:**
- Produces: request-received acknowledgement email for pending records.
- Preserves: confirmed and cancelled admin emails as separate later status notifications.

- [ ] **Step 1: Add failing email distinction tests**

```ts
it("describes a new submission as awaiting manual confirmation", async () => {
  await sendBookingConfirmationToCustomer(baseOptions);
  const html = sentEmail.html;
  expect(html).toContain("Booking Request Received");
  expect(html).toContain("awaiting confirmation");
  expect(html).toContain("Pay in Store");
  expect(html).not.toContain("Your booking is confirmed");
});

it("uses the exact YezYY brand casing", async () => {
  await sendBookingConfirmationToCustomer(baseOptions);
  expect(sentEmail.subject).toContain("YezYY");
  expect(sentEmail.html).not.toContain(">YEZZ<");
});
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @yezz/api test -- src/lib/email.test.ts`

Expected: FAIL because the current acknowledgement says booking confirmation and uses `YEZZ`.

- [ ] **Step 3: Implement request-received email and bilingual UI copy**

Use these exact user-facing states:

```json
{
  "checkoutTitle": "Booking Request",
  "confirmSubmit": "Submit Booking Request",
  "thankYou": "Booking Request Received",
  "confirmMessage": "We will review your request and contact you to confirm it. No online payment is required; please pay in store."
}
```

Chinese:

```json
{
  "checkoutTitle": "预约申请",
  "confirmSubmit": "提交预约申请",
  "thankYou": "预约申请已收到",
  "confirmMessage": "我们会人工审核并联系您确认。无需线上付款，请到店付款。"
}
```

Update the initial email subject/body to `YezYY Booking Request Received` and equivalent Chinese wording. Leave the later confirmed email explicitly confirmed.

Read the sender identity from `EMAIL_FROM` and reply address from `EMAIL_REPLY_TO`. In production, fail fast at startup when `EMAIL_FROM` is absent instead of silently using `yezz.studio`; keep `izzybella.chen@gmail.com` as the approved public/reply address. Do not claim that Gmail is a verified transactional sender.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/lib/email.test.ts
corepack pnpm --filter @yezz/web test
corepack pnpm --filter @yezz/web exec eslint app/[locale]/cart/page.tsx components/book components/projects/ProjectDetail.tsx
```

Expected: tests and focused lint pass.

- [ ] **Step 5: Commit**

```bash
git add .env.example docs/production-config-checklist.md apps/api/src/lib/email.ts apps/api/src/lib/email.test.ts apps/web/lib/i18n apps/web/app/[locale]/cart/page.tsx apps/web/components/book apps/web/components/projects/ProjectDetail.tsx apps/web/e2e/booking.spec.ts apps/web/e2e/cart.spec.ts
git commit -m "feat: clarify manual booking confirmation"
```

### Task 4: Chinese Booking Status Dialog and Dashboard Copy

**Files:**
- Create: `apps/web/components/admin/BookingStatusDialog.tsx`
- Modify: `apps/web/app/admin/bookings/page.tsx`
- Modify: `apps/web/app/admin/bookings/[id]/page.tsx`
- Modify: `apps/web/app/admin/page.tsx`
- Test: `apps/web/lib/admin/booking-status.test.ts`
- Create: `apps/web/lib/admin/booking-status.ts`

**Interfaces:**
- Produces: `requiresCustomerNote(status): boolean`.
- Produces: controlled `BookingStatusDialog` returning `{ status, note }` only after explicit confirmation.

- [ ] **Step 1: Write the failing status-rule test**

```ts
expect(requiresCustomerNote("confirmed")).toBe(true);
expect(requiresCustomerNote("cancelled")).toBe(true);
expect(requiresCustomerNote("pending")).toBe(false);
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @yezz/web test -- lib/admin/booking-status.test.ts`

Expected: FAIL because `requiresCustomerNote` does not exist.

- [ ] **Step 3: Implement the rule and controlled Chinese dialog**

```ts
export function requiresCustomerNote(status: BookingStatus) {
  return status === "confirmed" || status === "cancelled";
}
```

Replace both `window.prompt` calls with a modal containing a labelled textarea, cancel button, and explicit confirm button. Keep the note optional for confirmation and visibly recommended for cancellation. Replace `Phase 1 内容管理概览` with `预约与内容管理概览`.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/admin/booking-status.test.ts
corepack pnpm --filter @yezz/web exec eslint components/admin/BookingStatusDialog.tsx app/admin/bookings app/admin/page.tsx lib/admin/booking-status.ts
```

```bash
git add apps/web/components/admin/BookingStatusDialog.tsx apps/web/lib/admin/booking-status.ts apps/web/lib/admin/booking-status.test.ts apps/web/app/admin/bookings apps/web/app/admin/page.tsx
git commit -m "fix: replace booking prompts with a status dialog"
```
