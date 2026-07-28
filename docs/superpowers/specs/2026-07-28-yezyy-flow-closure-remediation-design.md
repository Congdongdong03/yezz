# YezYY Flow-Closure Remediation Design

## Purpose

Close the production workflow gaps found in the 2026-07-28 full-flow audit without replacing the whole application or publishing a request path before staff can operate it safely.

The target operating loop is:

1. A customer chooses a real YezYY experience, product project, or party package.
2. The customer chooses a valid Melbourne date, time slot, and number of people.
3. The server stores one idempotent pending request and reserves capacity once.
4. Chinese-admin staff see the exact offering, contact details, date, start/end time, and notification state.
5. Staff contact, confirm, or cancel the request through a compare-and-set transition.
6. The status change and its email notification are durably recorded.
7. The customer pays at the studio.

Online payment, automatic confirmation, and fictional catalogue data remain out of scope.

## Scope and Priority

### Launch gate

The following must be complete before the corresponding public request CTA is enabled:

- a trustworthy end-customer identity for rate limiting;
- durable rate limits that do not depend on one Fly process;
- server-authoritative offering and slot data;
- idempotent create and compare-and-set status changes;
- capacity bounds enforced in PostgreSQL;
- exact time details in Chinese admin;
- durable email delivery state and a staff-visible retry path;
- an end-to-end test that follows the same request through admin and captured email.

### Incremental enablement

Three independent API capability flags control public CTAs:

- `REQUEST_FLOW_EXPERIENCE_ENABLED`
- `REQUEST_FLOW_PRODUCT_ENABLED`
- `REQUEST_FLOW_PARTY_ENABLED`

The public API exposes these as read-only capabilities. When a capability is false, the site shows call/email contact instead of a form that cannot complete. Experience requests are enabled first, then product requests, then party requests. A catalogue entry may be visible while its request capability remains disabled.

This is safer than releasing all three workflows together and avoids hiding truthful catalogue content.

## Approaches Considered

### Recommended: harden the two existing request aggregates

Keep `bookings` for experience and party requests, and keep `cart_orders` for multi-item product requests. Add shared slot-reservation, status-transition, audit, email-outbox, and admin presentation primitives.

Benefits:

- additive migrations and a rollback-compatible deployment;
- existing booking/order screens and service boundaries remain useful;
- party requests reuse the mature booking lifecycle;
- cart orders retain their legitimate multi-item shape;
- work can be enabled one request type at a time.

Cost:

- two aggregates continue to exist;
- shared behaviour must be enforced through shared helpers and parity tests.

### Rejected for this launch: replace everything with one universal request table

A new `requests`/`request_items` model would be conceptually tidy, but it requires migrating live records, rewriting every public/admin route, and changing all tests at once. The cutover and rollback surface is too large for the current production state.

### Rejected as the final state: contact-only forms

Turning every path into a generic contact form would be quick, but staff would still lack authoritative item, schedule, capacity, transition, and notification data. Contact-only remains the safe fallback whenever a capability flag is off; it is not the closed-loop implementation.

## Architecture Decisions

### 1. Same-origin web backend-for-frontend

All browser mutations go through a Next.js backend-for-frontend (BFF) route under the canonical web origin:

```text
Browser
  -> https://yezyy.com/api/backend/...
  -> signed server-to-server request
  -> https://yezz-api.fly.dev/api/v1/...
```

Public catalogue GETs may continue to use the existing server-side API client. Public request submission, admin login/logout, authenticated admin calls, and uploads use the BFF.

The BFF provides:

- a first-party `Secure`, `HttpOnly`, `SameSite=Lax` admin cookie on `yezyy.com`;
- a single CSRF boundary that rejects unsafe requests whose `Origin` is not the canonical web origin;
- a trustworthy place to read Vercel's platform-supplied client address;
- an authenticated server-to-server channel to Fly.

The Fly API continues to validate the JWT and roles. The BFF is a transport trust boundary, not an authorization replacement.

### 2. Signed client identity

The BFF derives the browser address from the platform-provided forwarding header, validates it with Node's `net.isIP`, and never accepts a client-supplied `x-yezyy-*` header. In local development only, loopback is allowed as a fallback.

For each proxied request it sends:

```text
X-YezYY-Client-IP
X-YezYY-Request-Id
X-YezYY-Request-Timestamp
X-YezYY-Body-SHA256
X-YezYY-Signature
Idempotency-Key                    # create requests only
```

The signature is:

```text
HMAC-SHA256(
  WEB_API_SHARED_SECRET,
  METHOD + "\n" +
  PATH_AND_QUERY + "\n" +
  REQUEST_ID + "\n" +
  UNIX_TIMESTAMP + "\n" +
  CLIENT_IP + "\n" +
  IDEMPOTENCY_KEY + "\n" +
  BODY_SHA256
)
```

The API checks the signature with `timingSafeEqual`, requires the timestamp within five minutes, checks the body digest against the received bytes, and rejects missing/invalid signatures on production auth, admin, upload, booking-create, and cart-order-create routes.

The API never trusts ordinary `X-Forwarded-For`. Direct public GETs remain unsigned. During rollout, Fly first accepts and logs signed requests without requiring them, the web BFF is deployed, and then enforcement is enabled.

### 3. PostgreSQL is authoritative for abuse control

Redis remains an optional cache, not the only production rate-limit store. Low-volume booking and admin traffic uses an atomic PostgreSQL bucket table:

```text
request_rate_limits
  scope
  subject_hash
  window_started_at
  request_count
  expires_at
  primary key (scope, subject_hash, window_started_at)
```

The subject is an HMAC hash of the normalized IP, never the raw address. An `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE request_count < limit RETURNING` operation makes the limit durable across Fly restarts and machines.

Scopes:

- booking creation: five per customer IP per hour;
- cart-order creation: five per customer IP per hour;
- login: five per `IP + normalized email` per hour and thirty per IP per hour;
- authenticated admin reads/writes: keyed by authenticated user ID, not IP.

Stale buckets are deleted opportunistically and by a daily maintenance pass. Rate-limit failure must not silently fall back to a process-local counter in production; a database failure returns `503`, because accepting an uncontrolled or globally mis-keyed request is not a safe degraded mode.

### 4. Keep two aggregates, share transactional primitives

`bookings` represents one experience or one party package. `cart_orders` represents one appointment containing one or more product projects. Both use:

- one customer contact;
- one number of people;
- one time slot;
- one immutable slot snapshot;
- one idempotency key;
- the same four status values: `new`, `contacted`, `confirmed`, `cancelled`;
- the same status-event and email-outbox system.

The shared server modules are responsible for slot reservation/release, transition validation, outbox enqueueing, and operational summaries. Public/admin DTOs remain explicit for each aggregate.

## Data Model

All changes are delivered in a forward, additive migration. New service validation is stricter than database nullability so the previous application version can remain rollback-compatible during deployment.

### Bookings

Add:

```text
request_kind              varchar, default 'experience', check experience|party
project_id                uuid null -> diy_projects.id ON DELETE RESTRICT
party_package_id          uuid null -> party_packages.id ON DELETE RESTRICT
offering_name_snapshot    jsonb null
offering_price_snapshot   varchar(128) null
slot_date                 date null
slot_start_time           varchar(8) null
slot_end_time             varchar(8) null
slot_timezone             varchar(64) default 'Australia/Melbourne'
idempotency_key           uuid default gen_random_uuid(), unique
```

Rules for new records:

- `experience` requires `project_id` and forbids `party_package_id`;
- `party` requires `party_package_id` and forbids `project_id`;
- `time_slot_id`, `number_of_people`, and customer `email` are required by the service;
- `preferred_date` is derived from `slot_date`;
- a caller-supplied `preferredDate` that disagrees with the slot is rejected;
- name and price snapshots are derived from the selected database offering.

Existing booking rows are backfilled as `experience`. If their referenced slot still exists, slot snapshots are copied from it. Otherwise `slot_date` is copied from `preferred_date` and start/end remain null. Legacy rows are labelled incomplete in admin rather than invented.

### Cart orders and items

Add to `cart_orders`:

```text
time_slot_id              uuid null -> time_slots.id ON DELETE RESTRICT
number_of_people          integer null
preferred_date            date null
slot_date                 date null
slot_start_time           varchar(8) null
slot_end_time             varchar(8) null
slot_timezone             varchar(64) default 'Australia/Melbourne'
locale                    varchar(8) null
idempotency_key           uuid default gen_random_uuid(), unique
```

Add to `cart_order_items`:

```text
style_id                  uuid null -> project_styles.id ON DELETE SET NULL
price_currency            varchar(10) default 'AUD'
```

New product requests require `timeSlotId`, `numberOfPeople`, `email`, and at least one `{ projectId, styleId? }` item. The server loads every project/style inside the create transaction and derives project name, project type, style name, displayed price, currency, and sort order. It rejects:

- a missing project;
- a non-product project on the cart path;
- a style that does not belong to the project;
- a supplied style when the project has no such style;
- any arbitrary client-provided name, type, or price.

Client snapshots are no longer part of the create contract.

### Time slots

Change both request foreign keys to `ON DELETE RESTRICT`.

Add database constraints:

```text
capacity >= 1
booked_count >= 0
booked_count <= capacity
start_time matches HH:MM
end_time matches HH:MM
start_time < end_time
```

Add a uniqueness index for date/start/end and the effective category (`NULL` treated as one shared value). Application validation rejects:

- a past Melbourne date;
- a date beyond the configured 365-day booking horizon;
- a slot outside YezYY's approved weekly hours;
- an overlap with an existing slot for the same effective category;
- updates that put capacity below booked count;
- start/end/category changes after any capacity is reserved.

There is no automatic pending-request expiry in this launch. Automatically releasing a real customer request without an agreed business policy is riskier than temporarily blocking a slot. Instead:

- a `new` request older than two business hours is shown as overdue;
- the admin dashboard and list keep it visible until staff contact, confirm, or cancel it;
- a future configurable hold-expiry policy requires owner approval.

### Status events

Add `request_status_events`:

```text
id                    uuid primary key
booking_id            uuid null -> bookings.id ON DELETE RESTRICT
cart_order_id         uuid null -> cart_orders.id ON DELETE RESTRICT
operation_id          uuid unique
from_status           varchar(32)
to_status             varchar(32)
admin_note            text null
actor_user_id         uuid -> users.id ON DELETE RESTRICT
created_at            timestamptz
check exactly one request foreign key is non-null
```

Every admin transition supplies `expectedStatus` and `operationId`. The transaction:

1. returns the existing result when `operationId` was already processed;
2. updates with `WHERE id = ? AND status = expectedStatus`;
3. returns `409 STATUS_CONFLICT` if no row changed;
4. conditionally releases capacity only after a successful transition to cancelled;
5. inserts the status event and its email outbox row in the same transaction.

This prevents duplicate capacity release and gives staff an audit history.

### Email outbox

Add `email_outbox`:

```text
id                    uuid primary key
dedupe_key            varchar(255) unique
booking_id            uuid null
cart_order_id         uuid null
status_event_id       uuid null
message_type          varchar(64)
recipient             varchar(255)
locale                varchar(8)
payload               jsonb
delivery_status       varchar(16)  # pending|processing|sent|failed
attempt_count         integer default 0
next_attempt_at       timestamptz
lease_expires_at      timestamptz null
provider_message_id   varchar(255) null
last_error            text null
sent_at               timestamptz null
created_at            timestamptz
updated_at            timestamptz
```

Initial customer acknowledgement, owner notification, and later status emails are enqueued in the same transaction as the business change. A worker claims rows with `FOR UPDATE SKIP LOCKED`, records the Resend message ID, and retries transient failures with bounded exponential backoff. After five failed attempts it leaves the row `failed`.

The API response means “request saved and notification queued,” not “email delivered.” Chinese admin shows pending/sent/failed, the last error in a safe truncated form, attempt count, and a retry button. Manual retry resets `next_attempt_at` and never creates a duplicate message because `dedupe_key` is unique.

When a legacy row has no email, staff can still change status, but admin shows `无邮箱，需电话联系`; no customer-email outbox row is created. New public requests require email.

### Per-staff read state

Add `admin_request_reads`:

```text
user_id               uuid -> users.id ON DELETE CASCADE
booking_id            uuid null -> bookings.id ON DELETE CASCADE
cart_order_id          uuid null -> cart_orders.id ON DELETE CASCADE
read_at                timestamptz
check exactly one request foreign key is non-null
unique per user/request
```

Opening a detail record upserts only that staff member's read receipt. Merely opening a list never marks unseen records read.

## Public API Contracts

### Experience/party booking create

`POST /api/v1/bookings`

Required header:

```text
Idempotency-Key: <UUID>
```

Experience body:

```json
{
  "kind": "experience",
  "projectId": "uuid",
  "timeSlotId": "uuid",
  "numberOfPeople": 2,
  "name": "Customer",
  "phone": "0430000000",
  "email": "customer@example.com",
  "wechat": null,
  "occasion": "date",
  "message": "",
  "locale": "en"
}
```

Party body:

```json
{
  "kind": "party",
  "partyPackageId": "uuid",
  "timeSlotId": "uuid",
  "numberOfPeople": 8,
  "name": "Customer",
  "phone": "0430000000",
  "email": "customer@example.com",
  "message": "",
  "locale": "en"
}
```

Created response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "new",
    "replayed": false,
    "notification": "queued"
  }
}
```

Retrying the same idempotency key returns the original ID with `replayed: true` and does not reserve capacity or enqueue email again.

### Product request create

`POST /api/v1/cart-orders`

```json
{
  "timeSlotId": "uuid",
  "numberOfPeople": 2,
  "name": "Customer",
  "phone": "0430000000",
  "email": "customer@example.com",
  "wechat": null,
  "message": "",
  "locale": "en",
  "items": [
    { "projectId": "uuid", "styleId": "uuid" }
  ]
}
```

Response and idempotency behaviour match booking create.

### Capabilities

`GET /api/v1/settings` adds:

```json
{
  "requestCapabilities": {
    "experience": true,
    "product": false,
    "party": false
  }
}
```

The API independently enforces each flag; hiding a web CTA is not the security boundary.

## Admin API Contracts

Booking and cart-order list endpoints both accept:

```text
page=1
limit=25
status=new|contacted|confirmed|cancelled
query=<name, phone, email, order suffix>
unread=true|false
overdue=true|false
```

Booking additionally accepts `kind=experience|party`.

Both return:

```json
{
  "data": [],
  "page": 1,
  "limit": 25,
  "total": 0,
  "totalPages": 0
}
```

Booking detail contains:

```json
{
  "kind": "experience",
  "offering": {
    "id": "uuid",
    "name": { "en": "Project", "zh": "项目" },
    "price": "From $43"
  },
  "slot": {
    "id": "uuid",
    "date": "2026-08-12",
    "startTime": "10:00",
    "endTime": "11:00",
    "timeZone": "Australia/Melbourne"
  },
  "notificationSummary": {
    "latestStatus": "sent",
    "failedCount": 0
  },
  "statusHistory": []
}
```

Cart-order detail uses the same `slot`, notification, and status-history shapes and includes the customer email.

Status update:

`PATCH /api/v1/admin/bookings/:id/status` or `/cart-orders/:id/status`

```json
{
  "status": "confirmed",
  "expectedStatus": "contacted",
  "operationId": "uuid",
  "note": "Confirmed by phone"
}
```

The response includes the updated record and `replayed`. A stale status returns `409` with current status so the admin can refresh safely.

Email delivery endpoints:

```text
GET  /api/v1/admin/email-deliveries?status=failed&page=1&limit=25
POST /api/v1/admin/email-deliveries/:id/retry
```

The dashboard summary includes:

- unseen for the current staff user;
- new;
- contacted;
- overdue new requests;
- confirmed today;
- failed email deliveries.

## Party Flow

Party packages remain public catalogue entities. A package's CTA opens a booking request that:

- carries the real `partyPackageId`;
- validates people against the current package `minPeople`/`maxPeople`;
- uses the same time-slot picker and customer contact fields as experience requests;
- snapshots the package name and price indicator;
- creates a `bookings.request_kind = 'party'` row;
- appears in the Chinese booking queue with a party label;
- uses the normal status, capacity, email, read, and audit lifecycle.

Old party wording about advance payment or refunds is not introduced. The public and email copy continues to state manual confirmation and payment in store.

## Product/Cart Flow

The cart is an appointment request, not e-commerce checkout.

- Items contain only catalogue IDs and optional style IDs.
- The schedule and people count apply to the whole cart request.
- One cart request reserves capacity once, regardless of item count.
- The API snapshots all admin-visible item text and price from the database.
- Chinese admin shows email, exact slot, people, every item/style, price/currency, status history, and email state.
- `contacted`, `confirmed`, and `cancelled` send the same class of customer status emails as bookings.
- Cancellation releases capacity once through the shared atomic primitive.

## Capacity and Consistency

Capacity is reserved when a valid new request is created. This preserves the existing conservative operating model: pending requests block the selected places until staff resolve them.

Reservation uses one conditional statement:

```sql
UPDATE time_slots
SET booked_count = booked_count + :people,
    updated_at = now()
WHERE id = :slot_id
  AND is_available = true
  AND booked_count + :people <= capacity
RETURNING *;
```

Release uses the corresponding lower-bound predicate. No separate read-then-write arithmetic is allowed.

Create transaction order:

1. validate authoritative offering/style;
2. reserve slot conditionally;
3. insert request with unique idempotency key and slot/offering snapshots;
4. insert initial email outbox rows;
5. commit.

Any conflict rolls back all steps. A duplicate idempotency key is resolved to the previously committed record.

## Email Delivery and Operational Closure

Email rendering remains in code; the outbox payload contains typed template inputs rather than pre-rendered HTML. This permits safe template fixes before retry.

Worker behaviour:

- poll at startup and every 30 seconds;
- claim at most 20 due messages;
- lease each claim for five minutes;
- retry network/429/5xx failures at 1, 5, 15, 60, and 240 minutes;
- classify invalid recipient/provider 4xx as failed without tight retry loops;
- store provider ID, timestamps, and a redacted error;
- never log message body, API key, full IP, or customer message.

Admin retry is an explicit state change but does not resend a row already marked sent.

The owner email recipient is `OWNER_EMAIL=congdongdong03@gmail.com`. Customer replies use `EMAIL_REPLY_TO=congdongdong03@gmail.com`. `EMAIL_FROM` must remain a Resend-verified sender and requires external DNS authorization if `yezyy.com` is not yet verified.

## Notification, Pagination, and Admin Operations

The Chinese admin becomes a work queue:

- default sort: unresolved first, then oldest unresolved, then newest closed;
- 25 rows per page;
- visible filters for type, status, unread, overdue, and search;
- exact Melbourne date and start/end time in list and detail;
- tap-to-call and tap-to-email links;
- status controls show the current delivery result;
- detail view marks only that record read for that staff user;
- a dashboard tile links directly to each actionable filter.

This design does not require real-time push notifications. Polling unread/queue counters every 60 seconds is sufficient for the current studio volume.

## AUD Migration and Production Bootstrap

The forward migration:

```sql
ALTER TABLE diy_projects
  ALTER COLUMN price_currency SET DEFAULT 'AUD';

UPDATE diy_projects
SET price_currency = 'AUD'
WHERE price_currency IS NULL;
```

It does not rewrite explicit `CNY` rows because those may be intentional historical data. Project create/update code always writes the selected currency, defaulting to AUD.

The current mock seed is renamed to `seed:dev-demo` and refuses to run when `NODE_ENV=production`. A new `bootstrap:production` command:

- inserts the approved YezYY settings only when the singleton is absent;
- never deletes or overwrites catalogue/request/media records;
- creates an initial admin only when no admin exists and explicit bootstrap credentials were supplied;
- refuses placeholder email/password values;
- prints no plaintext password;
- is idempotent;
- requires the explicit guard `ALLOW_PRODUCTION_BOOTSTRAP=YezYY`.

`deploy.sh --init` and the production Compose setup service use the production bootstrap, never the demo seed.

## Migration, Backfill, Deployment, and Rollback

### Pre-deploy backup and inspection

Before migration:

- record the application commit;
- take/confirm a Neon restore point;
- query row counts and current constraints/defaults;
- verify there are no negative or over-capacity slot rows;
- list bookings whose `preferred_date` conflicts with their joined slot.

Any inconsistent row is reported for manual repair; the migration does not invent times.

### Forward migration

The migration is additive:

- add nullable/defaulted columns and new tables;
- backfill booking slot snapshots and idempotency keys;
- add AUD default;
- add indexes and checks only after validation queries pass;
- replace slot foreign-key delete behaviour with `RESTRICT`;
- leave legacy text fields in place.

### Staged application rollout

1. Deploy Fly with migrations, new readers, signed-request logging, and all request capabilities false.
2. Deploy the Vercel BFF and make admin/public mutations use it.
3. Verify signed identity, first-party login cookie, CSRF rejection, and per-customer limits.
4. Enable signed-request enforcement.
5. Enable experience requests after its closure E2E and production smoke test.
6. Enable product requests after cart parity smoke tests.
7. Enable party requests after party closure smoke tests.

### Rollback

Rollback is an application rollback, not a destructive down migration:

- disable all three request capability flags;
- redeploy the previous web/API commit;
- keep additive columns/tables and AUD default;
- pause the outbox worker with `EMAIL_OUTBOX_WORKER_ENABLED=false`;
- retain queued messages for inspection instead of deleting them.

New columns have database defaults or remain nullable, so the previous app can still insert records during rollback. No rollback command drops customer requests, status events, read receipts, or delivery history.

## Testing Strategy

All behaviour changes use TDD.

### Unit and repository tests

- signed-envelope canonicalization, body digest, expiry, and timing-safe rejection;
- platform IP normalization and spoofed-header rejection;
- PostgreSQL rate-limit bucket isolation between two IPs;
- login keys isolate IP/email pairs;
- slot date/time/business-hours/overlap validation;
- atomic capacity reserve/release lower and upper bounds;
- preferred-date mismatch rejection;
- offering/style ownership and snapshot derivation;
- party min/max validation;
- idempotent replay does not change capacity or duplicate outbox rows;
- stale status transition returns conflict;
- repeated operation ID returns the first transition result;
- outbox deduplication, leasing, retry schedule, and provider result handling;
- per-user read receipt isolation;
- paginated totals and filters.

### Integration tests

Run against PostgreSQL:

- concurrent duplicate create with the same idempotency key creates one row;
- concurrent requests cannot exceed capacity;
- concurrent cancellation releases capacity once;
- a referenced slot cannot be deleted;
- migration applies to both an empty database and a legacy fixture;
- production bootstrap creates no projects, parties, gallery images, or sample credentials.

### End-to-end closure tests

Use Mailpit or an equivalent local mail capture:

1. experience request -> exact admin record -> contacted/confirmed -> status email;
2. multi-item product request -> authoritative snapshot -> exact admin record -> cancellation -> capacity restored once -> status email;
3. party request -> min/max and slot validation -> exact admin record -> confirmation -> status email;
4. two browser IP identities do not share a five-request bucket;
5. the sixth request for one identity returns `429` with `Retry-After`;
6. a simulated email failure appears in Chinese admin and a retry reaches Mailpit;
7. the second staff user still sees a record as unread after the first staff user opens it.

Production browser checks do not create a real request unless the owner explicitly authorizes a controlled test record.

## Security and Privacy Boundaries

- Only the Next BFF and Fly API receive `WEB_API_SHARED_SECRET`; it is never `NEXT_PUBLIC_*`.
- Public browsers cannot choose the signed client IP.
- The BFF validates Origin on every unsafe request.
- Fly still validates JWT and role on every admin request.
- Rate-limit tables contain keyed hashes, not raw IP addresses.
- Email/outbox logs never contain API keys or full message bodies.
- Customer-supplied names/messages are escaped at render time.
- Client-supplied price, project name, project type, style name, slot date, and slot time are ignored.
- Public form idempotency keys are random UUIDs and do not authorize reads.
- Admin transition operation IDs prevent replay effects but do not replace authentication.

## External Authorization and Configuration

Code work can proceed without the owner present. The following production actions require external access or approval and are kept separate:

- set the shared BFF/API secret in both Vercel and Fly;
- confirm or create the Neon restore point before migration;
- verify `yezyy.com` sender DNS with Resend if it is not already verified;
- set Fly email secrets, including the approved Gmail owner/reply address;
- deploy Fly and Vercel production versions;
- enable each production request capability after smoke tests;
- create a real controlled production request only if the owner explicitly authorizes it.

The code must not read an email account to obtain passwords, one-time codes, API keys, or DNS credentials automatically. Those remain owner-controlled authorization steps.

## Deferred Decisions

These are not launch blockers and should not be guessed:

- automatic expiry duration for pending capacity holds;
- online deposits or payments;
- SMS delivery;
- a unified replacement for the two request tables;
- real-time push notifications;
- automatic staff assignment;
- converting explicit historical CNY rows to AUD.

