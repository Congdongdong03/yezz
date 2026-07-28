# YezYY Production Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct authentication lifetime, protect public request endpoints, make cart insertion deterministic, and repair staff password lifecycle and API contracts.

**Architecture:** Extract small pure helpers around cookie options, request throttling, cart insertion, and password validation so each production behaviour can be tested directly. Keep Fastify routes thin and preserve the existing Redis/JWT/bcrypt infrastructure.

**Tech Stack:** Fastify 5, @fastify/cookie, @fastify/jwt, Redis/ioredis, React 19, bcryptjs, Vitest, TypeScript.

## Global Constraints

- Authentication JWT and cookie lifetime are both 24 hours.
- Public booking/cart requests are limited to five submissions per IP per hour.
- Generated passwords are shown only to the authenticated administrator and are never emailed in plaintext.
- Admin and staff users can replace a generated password after authenticating.
- Existing role boundaries remain: staff handles bookings/orders; admin controls content/settings/users.

---

### Task 1: Authentication Cookie Lifetime

**Files:**
- Create: `apps/api/src/lib/auth-cookie.ts`
- Create: `apps/api/src/lib/auth-cookie.test.ts`
- Modify: `apps/api/src/routes/v1/auth.routes.ts`

**Interfaces:**
- Produces: `AUTH_SESSION_SECONDS = 86_400` and `buildAuthCookieOptions(isProduction: boolean)`.
- Consumed by: login and logout cookie handling.

- [ ] **Step 1: Write the failing cookie test**

```ts
it("uses a 24 hour maxAge expressed in seconds", () => {
  expect(buildAuthCookieOptions(true)).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 86_400,
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @yezz/api test -- src/lib/auth-cookie.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement and use the helper**

```ts
export const AUTH_SESSION_SECONDS = 60 * 60 * 24;

export function buildAuthCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: AUTH_SESSION_SECONDS,
  };
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @yezz/api test -- src/lib/auth-cookie.test.ts`

```bash
git add apps/api/src/lib/auth-cookie.ts apps/api/src/lib/auth-cookie.test.ts apps/api/src/routes/v1/auth.routes.ts
git commit -m "fix: align auth cookie with JWT lifetime"
```

### Task 2: Cart Request Rate Limit and Input Bounds

**Files:**
- Create: `apps/api/src/lib/public-request-limit.ts`
- Create: `apps/api/src/lib/public-request-limit.test.ts`
- Modify: `apps/api/src/routes/v1/cart-orders.routes.ts`
- Modify: `apps/api/src/services/cart-orders.service.ts`
- Modify: `apps/api/src/lib/validation.ts`
- Modify: `apps/api/src/lib/validation.test.ts`

**Interfaces:**
- Produces: `enforcePublicRequestLimit(redis, key, reply): Promise<void>`.
- Consumes: existing `checkRateLimit`.
- Enforces: five requests per key per 3,600 seconds.

- [ ] **Step 1: Write a failing sixth-request test**

```ts
it("rejects the sixth request within one hour", async () => {
  const redis = createInMemoryRateLimitRedis();
  for (let i = 0; i < 5; i += 1) {
    await enforcePublicRequestLimit(redis, "cart:203.0.113.10", reply);
  }
  await expect(
    enforcePublicRequestLimit(redis, "cart:203.0.113.10", reply),
  ).rejects.toMatchObject({ statusCode: 429, code: "RATE_LIMITED" });
  expect(reply.headers["Retry-After"]).toBeDefined();
});
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @yezz/api test -- src/lib/public-request-limit.test.ts`

Expected: FAIL because the limiter helper does not exist.

- [ ] **Step 3: Implement and attach the limiter**

```ts
export async function enforcePublicRequestLimit(
  redis: RedisLike,
  key: string,
  reply: Pick<FastifyReply, "header">,
) {
  const result = await checkRateLimit(redis, key, 5, 3600);
  if (!result.allowed) {
    reply.header("Retry-After", String(result.retryAfter ?? 3600));
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  }
}
```

Call it before creating a cart request with key `ratelimit:cart-orders:${request.ip}`. Add explicit maximum lengths for customer name, phone, email, WeChat, message, and item snapshot fields.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/lib/public-request-limit.test.ts
corepack pnpm --filter @yezz/api test -- src/lib/validation.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/public-request-limit.ts apps/api/src/lib/public-request-limit.test.ts apps/api/src/routes/v1/cart-orders.routes.ts apps/api/src/services/cart-orders.service.ts apps/api/src/lib/validation.ts apps/api/src/lib/validation.test.ts
git commit -m "fix: protect public booking requests"
```

### Task 3: Deterministic Cart Insertion and Localised Validation

**Files:**
- Create: `apps/web/lib/cart/items.ts`
- Create: `apps/web/lib/cart/items.test.ts`
- Create: `apps/web/lib/cart/validation.ts`
- Create: `apps/web/lib/cart/validation.test.ts`
- Modify: `apps/web/lib/cart/context.tsx`
- Modify: `apps/web/app/[locale]/cart/page.tsx`
- Modify: `apps/web/lib/i18n/messages/en.json`
- Modify: `apps/web/lib/i18n/messages/zh.json`

**Interfaces:**
- Produces: `insertCartItem(items, item): { items: CartItem[]; added: boolean }`.
- Produces: `validateCartContact({ name, phone }, locale): Record<string, string[]>`.

- [ ] **Step 1: Write failing cart helper tests**

```ts
it("adds a new project and reports true", () => {
  const result = insertCartItem([], phoneCase);
  expect(result).toEqual({ items: [phoneCase], added: true });
});

it("keeps the existing list and reports false for a duplicate", () => {
  const result = insertCartItem([phoneCase], phoneCase);
  expect(result).toEqual({ items: [phoneCase], added: false });
});

it("uses English validation on the English page", () => {
  expect(validateCartContact({ name: "", phone: "" }, "en")).toEqual({
    name: ["Please enter your name"],
    phone: ["Please enter your phone number"],
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @yezz/web test -- lib/cart`

Expected: FAIL because the helper modules do not exist.

- [ ] **Step 3: Implement pure helpers and consume them**

```ts
export function insertCartItem(items: CartItem[], item: CartItem) {
  if (items.some((current) => current.projectId === item.projectId)) {
    return { items, added: false };
  }
  return { items: [...items, item], added: true };
}
```

Compute the result from the current cart state before scheduling React state, then update `items` with `result.items`. Replace hard-coded Chinese errors with `validateCartContact`.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
corepack pnpm --filter @yezz/web test -- lib/cart
corepack pnpm --filter @yezz/web exec eslint lib/cart app/[locale]/cart/page.tsx
```

```bash
git add apps/web/lib/cart apps/web/app/[locale]/cart/page.tsx apps/web/lib/i18n
git commit -m "fix: make cart behaviour deterministic"
```

### Task 4: Staff Password Contract and Self-Service Change

**Files:**
- Modify: `apps/api/src/services/admin/users.admin.service.ts`
- Create: `apps/api/src/services/admin/users.admin.service.test.ts`
- Modify: `apps/api/src/repositories/users.repository.ts`
- Modify: `apps/api/src/routes/v1/admin/me.routes.ts`
- Modify: `apps/api/src/lib/email.ts`
- Modify: `apps/api/src/lib/email.test.ts`
- Modify: `apps/web/lib/admin/api.ts`
- Modify: `apps/web/lib/admin/types.ts`
- Create: `apps/web/app/admin/account/page.tsx`
- Modify: `apps/web/components/admin/AdminShell.tsx`
- Modify: `apps/web/app/admin/users/page.tsx`

**Interfaces:**
- Produces: create response `{ user, initialPassword }`.
- Produces: reset response `{ user, newPassword }`.
- Produces: `changePassword(userId, currentPassword, newPassword): Promise<{ ok: true }>` through `POST /api/v1/admin/me/password`.
- Produces: repository method `findByIdWithPasswordHash(id)` used only for authenticated credential verification.

- [ ] **Step 1: Write failing service-contract tests**

```ts
it("returns the generated initial password to the authenticated admin caller", async () => {
  const result = await service.create({
    email: "staff@example.com",
    name: "Staff",
    role: "staff",
  });
  expect(result.initialPassword).toMatch(/^[A-Za-z0-9_-]{12}$/);
  expect(await bcrypt.compare(result.initialPassword, stored.passwordHash)).toBe(true);
});

it("does not send the plaintext password in email", async () => {
  await service.create({
    email: "staff@example.com",
    name: "Staff",
    role: "staff",
    password: "SafeTemporary42!",
  });
  expect(sentEmail.html).not.toContain("SafeTemporary42!");
});
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @yezz/api test -- src/services/admin/users.admin.service.test.ts`

Expected: FAIL because responses omit passwords and the email currently embeds plaintext.

- [ ] **Step 3: Write failing password-change tests**

```ts
it("rejects an incorrect current password", async () => {
  await expect(
    service.changePassword(user.id, "wrong", "NewPassword42!"),
  ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CREDENTIALS" });
});

it("stores a valid replacement password", async () => {
  await expect(
    service.changePassword(user.id, "CurrentPassword42!", "NewPassword42!"),
  ).resolves.toEqual({ ok: true });
  expect(await bcrypt.compare("NewPassword42!", stored.passwordHash)).toBe(true);
});
```

- [ ] **Step 4: Implement minimal password lifecycle**

Return generated credentials only in the authenticated admin API response. Change welcome/reset email to:

```html
<p>Your YezYY Admin account is ready.</p>
<p>Please obtain your temporary password from your administrator, then change it after signing in.</p>
```

Add `findByIdWithPasswordHash`, authenticated current-password verification, minimum 12-character replacement validation, bcrypt hash update, Chinese account page, and nav entry.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
corepack pnpm --filter @yezz/api test -- src/services/admin/users.admin.service.test.ts src/lib/email.test.ts
corepack pnpm --filter @yezz/web test
corepack pnpm --filter @yezz/web exec eslint app/admin/account/page.tsx app/admin/users/page.tsx components/admin/AdminShell.tsx lib/admin
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/admin/users.admin.service.ts apps/api/src/services/admin/users.admin.service.test.ts apps/api/src/repositories/users.repository.ts apps/api/src/routes/v1/admin/me.routes.ts apps/api/src/lib/email.ts apps/api/src/lib/email.test.ts apps/web/lib/admin apps/web/app/admin/account/page.tsx apps/web/components/admin/AdminShell.tsx apps/web/app/admin/users/page.tsx
git commit -m "fix: secure staff password lifecycle"
```
