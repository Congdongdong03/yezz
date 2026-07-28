# YezYY Production Phase 1 Design

## Purpose

Convert the currently deployed demo-style site into a truthful first-stage production website for the operating YezYY studio in Glen Waverley. Phase 1 prioritises accurate business identity, an unambiguous booking-request workflow, production safety, and a professional empty-catalogue experience while real project information and photography are being prepared.

## Canonical Business Identity

- Public brand spelling and casing: `YezYY`
- Canonical website origin: `https://yezyy.com`
- Studio address: `G082/235 Springvale Rd, Glen Waverley VIC 3150`
- Public phone display: `0430 787 712`
- Public phone link value: `0430787712`
- Public email: `izzybella.chen@gmail.com`
- Xiaohongshu account ID: `95848743904`
- Currency: `AUD`
- Online payment: not offered
- Payment method: customers pay in person at the studio
- Admin language: Chinese

The public website remains bilingual in English and Chinese. Internal package names such as `@yezz/api`, database table names, repository name, and existing migration identifiers remain unchanged in Phase 1 to avoid unnecessary deployment risk. All customer-visible and staff-visible brand copy changes from `YEZZ` to `YezYY`.

## Business Hours

The website and seed/default settings use:

| Day | Hours |
| --- | --- |
| Monday | 9:30 am–5:00 pm |
| Tuesday | 9:30 am–5:00 pm |
| Wednesday | 9:30 am–5:00 pm |
| Thursday | 9:30 am–8:30 pm |
| Friday | 9:30 am–8:30 pm |
| Saturday | 9:30 am–5:30 pm |
| Sunday | 10:00 am–5:00 pm |

English and Chinese pages render these hours in locale-appropriate labels. The data model may continue storing the hours as settings text in Phase 1; a structured weekly-hours editor is outside this phase.

## Customer Booking Flow

Submitting a form creates a **booking request**, not a confirmed booking.

1. The customer selects an available experience or submits an enquiry.
2. The public form explains that no online payment is required.
3. Submission creates a booking with the existing pending status.
4. The success screen says that YezYY received the request and will confirm it manually.
5. The initial customer email is a request-received acknowledgement, not a booking confirmation.
6. A Chinese-speaking staff member reviews the request in the Chinese admin.
7. Only an explicit admin status change to confirmed sends the final confirmation email.
8. The customer pays in AUD at the studio.

Public copy must avoid `Checkout`, `Place Order`, `Booking Confirmed`, or equivalent wording before staff confirmation. Preferred English phrases are `Request a Booking`, `Submit Booking Request`, `Booking Request Received`, `Awaiting Confirmation`, and `Pay in Store`. Chinese equivalents use `提交预约申请`, `预约申请已收到`, `等待人工确认`, and `到店付款`.

Product-style cart submissions follow the same request model. They are enquiries or booking requests for selected projects, not e-commerce purchases.

## Public Website Behaviour

### Brand and metadata

- Navbar, footer, page metadata, SEO titles, email templates, Swagger title, and admin title use `YezYY`.
- Canonical URLs, sitemap generation, CORS examples, and production documentation use `https://yezyy.com`.
- Existing `yezz.studio` example addresses are removed from active defaults and production guidance.

### Contact and location

- Contact and footer sections show the real Glen Waverley address, phone, email, hours, and Xiaohongshu ID.
- The address links to a Google Maps query for the exact address.
- Phone uses a `tel:` link and email uses a `mailto:` link.
- WeChat, Instagram, QR code, and other unavailable channels are hidden rather than populated with sample values.

### Catalogue without fake content

- No fictional projects, prices, or AI-generated project photographs are published.
- When the production API returns no projects, parties, or gallery items, each page shows a deliberate bilingual empty state explaining that the menu or gallery is being prepared.
- Empty states direct customers to call or email the studio.
- The homepage does not render blank content grids or fake imagery when collections are empty.
- Real project details and real photography will be added through the admin in Phase 2.

### Currency

- New projects default to `AUD`.
- Price formatting supports `$` for AUD.
- Existing CNY formatting remains supported for backward compatibility, but CNY is no longer the default.

## Chinese Admin Behaviour

- Admin navigation and operational screens remain Chinese.
- The admin brand changes to `YezYY Admin`.
- The dashboard removes `Phase 1` demo wording.
- Booking status language clearly distinguishes `待确认` from `已确认`.
- Status updates that require a customer-facing note use a proper controlled dialog or form rather than `window.prompt`.
- The login form no longer pre-fills `admin@yezz.local`.
- Missing production settings are shown as fields that require configuration, never as Shanghai or `+86` sample data.

## Production Safety Fixes

### Authentication cookie

The authentication cookie lifetime uses seconds and matches the 24-hour JWT lifetime. Production remains `Secure` and `HttpOnly`. Cross-site cookie behaviour is retained for the existing Vercel/Fly deployment, and the design records explicit CSRF hardening as a follow-up if the API remains on a different site.

### Public request abuse protection

Cart-order/request submission receives an IP-based Redis rate limit equivalent to the existing booking limit: five submissions per hour, with `429` and `Retry-After` when exceeded.

### Cart state correctness

Adding a cart item returns a reliable result without depending on when React executes a state updater. Duplicate detection and drawer behaviour are deterministic.

### Admin user password contract

The API and frontend must agree on the create/reset response. Phase 1 returns the generated initial or reset password only to the authenticated administrator who initiated the action, while the password continues to be stored only as a bcrypt hash.

The welcome/reset email does not include the plaintext password. It tells the staff member to obtain it from the administrator. A self-service password-change flow is added for authenticated admin/staff users so the generated password can be replaced immediately.

### Validation and localisation

- English cart validation uses English messages.
- Chinese cart validation uses Chinese messages.
- Form values receive sensible maximum lengths at API boundaries.
- Customer-facing email content remains HTML escaped.

## Repository and Verification Improvements

- Stop tracking `node_modules` shims/cache files and historical Playwright screenshots/logs that are generated artifacts.
- Ensure ignored paths cover workspace-level dependencies and Playwright outputs.
- Make fresh-clone commands build `@yezz/db` before API type-checking, testing, or building.
- Resolve the current web lint failures in files touched by Phase 1; the completion gate requires the full web lint command to pass.
- Keep the existing build scripts compatible with Vercel and Fly.io.

## Tests

Implementation follows test-driven development for behavioural changes.

Required automated coverage:

- AUD price formatting and AUD default fallback.
- Authentication cookie max-age equals 24 hours in seconds.
- Cart-order rate limiting allows five requests and rejects the sixth.
- Cart item insertion returns true for a new item and false for a duplicate.
- English and Chinese cart validation messages match the active locale.
- Admin create/reset password response matches the frontend contract.
- Plaintext passwords are absent from staff emails.
- Password change rejects an incorrect current password and accepts a valid replacement.
- Booking request acknowledgement and confirmed-booking email use distinct wording.
- Empty catalogue pages render the intentional contact state.

Completion verification includes:

- database package build;
- monorepo TypeScript type-check;
- API unit tests;
- web lint;
- API production build;
- web production build against the production API;
- focused browser checks in English and Chinese without submitting a real request.

Full local end-to-end tests requiring PostgreSQL, Redis, and seeded content are run when the test services are available. They must not create records in the production database.

## Deployment and Production Data

Code changes are committed and pushed only after verification. Deployment follows the repository's existing Vercel web and Fly.io API setup.

Because changing seed/default code does not update an existing production database, the live singleton settings record must also be updated through the authenticated Chinese admin or a narrowly scoped production migration:

- store name;
- address;
- weekly business hours;
- phone;
- email;
- Xiaohongshu ID;
- canonical URL and SEO fields;
- removal of unavailable social fields and sample hero data.

The production update must not create fictional catalogue content. After deployment, the public site and production API are checked for the exact approved business identity and for the absence of Shanghai, CNY-default, `yezz.studio`, and sample-contact values.

## Out of Scope

- Online payments, deposits, Stripe, Square, or checkout settlement.
- Automatic booking confirmation.
- Fictional project catalogue entries.
- AI-generated project photography presented as real work.
- A structured weekly-hours database redesign.
- Renaming internal workspace packages, database tables, migration history, or the GitHub repository.
- A new custom email domain; Gmail remains the approved public address for Phase 1.
- Phase 2 project content and photography, which will be specified after the owner supplies real project details.
