# Admin Password Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, non-enumerating email password recovery flow for existing YezYY administrators.

**Architecture:** Extend the existing password setup service so recovery requests reuse its one-hour, one-use tokens and email outbox. Expose the behavior through a rate-limited public API endpoint and the signed same-origin web proxy, then add a small Chinese admin recovery page linked from login.

**Tech Stack:** Fastify, Drizzle/PostgreSQL repositories, Next.js 16, React 19, Vitest.

## Global Constraints

- Never return whether an email address belongs to an administrator.
- Normalize email with NFKC, trim, and lowercase before lookup.
- Reset links expire after one hour and a new link revokes prior active links.
- New passwords require at least 12 characters and completing a reset invalidates previous sessions.
- Booking, party, and product request switches remain closed.

---

### Task 1: Password recovery service and public API

**Files:**
- Modify: `apps/api/src/services/password-setup.service.ts`
- Modify: `apps/api/src/services/password-setup.service.test.ts`
- Modify: `apps/api/src/routes/v1/auth.routes.ts`
- Modify: `apps/api/src/routes/v1/auth.routes.test.ts`

**Interfaces:**
- Produces: `passwordSetup.requestForEmail(email: unknown): Promise<{ ok: true }>`
- Produces: `POST /api/v1/auth/forgot-password` with `{ email }`

- [x] Write a failing service test proving an existing mixed-case email queues a replacement link while a missing or malformed email returns the same `{ ok: true }` result.
- [x] Run the focused API test and confirm it fails because `requestForEmail` is missing.
- [x] Implement `requestForEmail` with normalized lookup and the existing transactional token issuer.
- [x] Write and run a failing route test for the generic response and both durable rate-limit buckets.
- [x] Implement the route and run the focused API tests until they pass.
- [x] Seal queued reset tokens, serialize concurrent issuance, scrub legacy raw links, and equalize successful response timing.

### Task 2: Same-origin proxy and admin recovery page

**Files:**
- Modify: `apps/web/app/api/backend/[...path]/route.ts`
- Modify: `apps/web/app/api/backend/[...path]/route.test.ts`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/app/admin/login/page.tsx`
- Create: `apps/web/app/admin/forgot-password/page.tsx`
- Create: `apps/web/app/admin/forgot-password/page.test.tsx`

**Interfaces:**
- Produces: `requestPasswordReset(email: string): Promise<{ ok: true }>`
- Produces: `/admin/forgot-password` email form and generic success state.

- [x] Write failing proxy and page tests that prove the endpoint is forwarded and the public page submits normalized email without exposing account existence.
- [x] Run the focused web tests and confirm the expected failures.
- [x] Add the proxy allowlist entry, API helper, recovery page, and login link.
- [x] Run the focused web tests and typecheck until they pass.

### Task 3: Release and live access verification

**Files:**
- Verify only: no additional implementation files.

**Interfaces:**
- Consumes: the API endpoint, web page, existing email outbox worker, and existing setup-password page.
- Produces: a deployed recovery flow that the owner can use without knowing the old password.

- [ ] Run the complete release verification suite and review the diff for secrets and unintended request-switch changes.
- [ ] Commit and push the reviewed changes, deploy the API, and wait for the web production deployment.
- [ ] Verify `/admin/login`, `/admin/forgot-password`, the generic submission response, the emailed one-time link flow, API health, and all three closed request switches in production.
