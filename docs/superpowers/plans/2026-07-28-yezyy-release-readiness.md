# YezYY Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a clean, reproducible repository and safely release the verified YezYY Phase 1 changes to the existing Vercel/Fly/Neon production stack.

**Architecture:** Remove tracked generated artifacts, make root scripts encode workspace build order, clear lint debt, and separate code deployment from the authenticated live-settings update. Production verification reads public state and never submits a real booking.

**Tech Stack:** pnpm workspaces, TypeScript, ESLint, Vitest, Next.js, Fastify, Git, Vercel, Fly.io, Neon PostgreSQL.

## Global Constraints

- Do not modify or delete production booking, order, user, project, party, gallery, or media records.
- Do not create fictional production catalogue content.
- Do not submit a real booking during browser verification.
- Only saved, verified code is pushed.
- Existing Vercel and Fly.io deployment topology remains unchanged.

---

### Task 1: Stop Tracking Generated Repository Artifacts

**Files:**
- Modify: `.gitignore`
- Remove from index: tracked `**/node_modules/**`
- Remove from index: tracked `.playwright-mcp/**`, `playwright-report/**`, and `test-results/**`

**Interfaces:**
- Produces: a source-only checkout in which dependency installation and browser tests do not dirty tracked files.

- [ ] **Step 1: Record the failing baseline**

Run:

```bash
git ls-files | rg '(^|/)node_modules/|(^|/)\\.playwright-mcp/|(^|/)(playwright-report|test-results)/'
```

Expected: output includes tracked dependency shims/cache and historical Playwright artifacts.

- [ ] **Step 2: Strengthen ignore rules and remove generated paths from the index**

```gitignore
**/node_modules/
.playwright-mcp/
**/playwright-report/
**/test-results/
```

Use `git rm --cached` only for the exact tracked generated paths returned by Step 1. Do not remove local source files or untracked user files.

- [ ] **Step 3: Verify the repository result**

Run:

```bash
git ls-files | rg '(^|/)node_modules/|(^|/)\\.playwright-mcp/|(^|/)(playwright-report|test-results)/'
```

Expected: exit 1 with no output.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: remove generated repository artifacts"
```

### Task 2: Fresh-Clone Build Order and Full Lint Cleanup

**Files:**
- Modify: `package.json`
- Modify: `apps/web/app/[locale]/page.tsx`
- Modify: affected admin list pages reported by `pnpm --filter @yezz/web lint`
- Modify: `apps/web/components/admin/AdminShell.tsx`
- Modify: `apps/web/components/book/BookingCalendar.tsx`
- Modify: `apps/web/app/admin/projects/[id]/edit/page.tsx`

**Interfaces:**
- Produces: root scripts that build `@yezz/db` before consumers.
- Produces: a web workspace with zero ESLint errors.

- [ ] **Step 1: Record the clean-checkout script failure**

From a checkout with no `packages/db/dist`, run:

```bash
corepack pnpm typecheck
```

Expected: FAIL resolving `@yezz/db`.

- [ ] **Step 2: Encode dependency build order**

Update root scripts:

```json
{
  "scripts": {
    "build:db": "pnpm --filter @yezz/db build",
    "pretypecheck": "pnpm build:db",
    "pretest:api": "pnpm build:db",
    "build:api": "pnpm build:db && pnpm --filter @yezz/api build",
    "verify": "pnpm typecheck && pnpm test:api && pnpm lint && pnpm build:api && pnpm build"
  }
}
```

- [ ] **Step 3: Fix the complete current lint report**

Replace public-homepage `any` casts with mapped API view types. Move immediate async loads out of synchronous effect bodies using stable callbacks or promise scheduling. Replace the internal `<a>` with Next `Link`. Keep behaviour unchanged.

- [ ] **Step 4: Verify fresh scripts and lint**

Run:

```bash
verify_tmp_dir=$(mktemp -d)
test ! -d packages/db/dist || mv packages/db/dist "$verify_tmp_dir/db-dist"
corepack pnpm typecheck
corepack pnpm test:api
corepack pnpm --filter @yezz/web lint
```

Expected: all commands exit 0; `pretypecheck` and `pretest:api` recreate the DB build automatically; ESLint reports zero errors.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/web
git commit -m "chore: make repository verification reproducible"
```

### Task 3: Full Verification, Code Push, and Production Settings Update

**Files:**
- Verify: all changed source and test files
- Update live data: existing production site-settings singleton only

**Interfaces:**
- Consumes: completed customer-experience and production-safety plans.
- Produces: verified branch and an authenticated settings update for the existing YezYY production environment.

- [ ] **Step 1: Run the complete local verification**

Run:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm test:api
corepack pnpm --filter @yezz/web test
corepack pnpm --filter @yezz/web lint
corepack pnpm build:api
NEXT_PUBLIC_API_URL=https://yezz-api.fly.dev NEXT_PUBLIC_USE_API=true NEXT_PUBLIC_SITE_URL=https://yezyy.com corepack pnpm build
git diff --check
```

Expected: every command exits 0 with no test or lint failures.

- [ ] **Step 2: Review the exact branch diff and secret scan**

Run:

```bash
git status --short
git diff main...HEAD --stat
git diff main...HEAD -- . ':!pnpm-lock.yaml'
rg -n --hidden --glob '!**/node_modules/**' 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|sk_live_|re_[A-Za-z0-9]{20,}|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@'
```

Expected: only intended source/docs/tests are changed and no live secret patterns are present.

- [ ] **Step 3: Commit any final verified corrections**

```bash
git add -A
git commit -m "release: prepare YezYY production phase one"
```

Skip the commit if the worktree is already clean.

- [ ] **Step 4: Push the verified branch**

Run: `git push -u origin codex/yezyy-production-phase-1`

Expected: remote branch is created without force push.

- [ ] **Step 5: Verify transactional email production configuration**

Confirm the currently configured Resend sender is verified for `yezyy.com`. Set Fly secrets so customer replies go to the approved Gmail address:

```text
EMAIL_FROM=YezYY <bookings@yezyy.com>
EMAIL_REPLY_TO=izzybella.chen@gmail.com
```

If `bookings@yezyy.com` is not verified in Resend, pause the release and ask the owner to approve the required DNS records. Do not substitute `yezz.studio`, spoof Gmail as a Resend sender, or expose a Resend API key.

- [ ] **Step 6: Update the authenticated production settings singleton**

Use the Chinese admin after the owner signs in. Set exactly:

```json
{
  "storeName": "YezYY",
  "address": "G082/235 Springvale Rd, Glen Waverley VIC 3150",
  "businessHours": "Monday 9:30 am–5:00 pm; Tuesday 9:30 am–5:00 pm; Wednesday 9:30 am–5:00 pm; Thursday 9:30 am–8:30 pm; Friday 9:30 am–8:30 pm; Saturday 9:30 am–5:30 pm; Sunday 10:00 am–5:00 pm",
  "phone": "0430 787 712",
  "email": "izzybella.chen@gmail.com",
  "xiaohongshu": "95848743904",
  "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=G082%2F235%20Springvale%20Rd%2C%20Glen%20Waverley%20VIC%203150",
  "wechatId": null,
  "wechatQrUrl": null,
  "instagram": null
}
```

Do not alter project, party, gallery, booking, order, user, or media records.

- [ ] **Step 7: Verify deployed public state without creating business records**

Check:

- `https://yezyy.com/en`
- `https://yezyy.com/zh`
- `https://yezyy.com/en/projects`
- `https://yezyy.com/en/contact`
- `https://yezyy.com/admin/login`
- `https://yezz-api.fly.dev/health`
- `https://yezz-api.fly.dev/api/v1/settings`

Expected:

- `YezYY` casing is exact.
- Glen Waverley address, phone, email, hours, AUD, and Xiaohongshu ID are visible where appropriate.
- Shanghai, `+86 138 0000 0000`, `hello@yezz.studio`, and customer-facing `YEZZ` are absent.
- Empty catalogue pages show a professional contact state.
- Initial booking language says awaiting manual confirmation and pay in store.
- API, database, and Redis health are successful.
- No booking or order is submitted.
