# GitHub Portfolio Presentation Design

## Goal

Present Wesley's GitHub as a concise, English-only full-stack engineering portfolio centred on YezYY, a production booking and operations platform used by an operating DIY studio in Melbourne.

## Audience and success criteria

The primary audience is a recruiter or technical interviewer reviewing the profile for a junior-to-mid full-stack engineering role in Melbourne.

Within thirty seconds, the public profile must make these facts clear:

1. Wesley is a Melbourne-based full-stack developer.
2. YezYY is a real production system for an operating business, not a tutorial project.
3. The work covers product UI, API design, relational data, operational workflows, testing, and deployment.

The result must remain factual, compact, professional, and easy to scan. It must not use contribution trophies, visitor counters, large badge walls, invented metrics, or unverified claims.

## Public repository strategy

- Keep `Congdongdong03/Congdongdong03` public because it powers the profile README.
- Keep `Congdongdong03/yezz` public and make it the only pinned project.
- Change `Congdongdong03/Congdongdong03.github.io` (Birthday Sky) to private, as explicitly selected by the user. This may make the corresponding GitHub Pages site unavailable.
- Keep all practice repositories private. Do not delete or archive them.
- Do not rename the `yezz` repository. GitHub and deployment links may depend on the existing repository identity; the public product name inside the README remains `YezYY`.
- Remove the outdated root-level `需求.md` brief from the current tree. Its initial WeChat-led MVP scope no longer represents the production product, and Git history remains the recovery path if it is ever needed.
- Remove unreferenced root-level development screenshots from the current tree. Keep the single current production screenshot under `docs/images/`; Git history remains the recovery path for the old captures.

## Account profile

Use the following public account presentation:

- Display name: `Wesley Cong`
- Bio: `Full Stack Developer building production web applications with TypeScript, Next.js, Fastify, and PostgreSQL.`
- Location: `Melbourne, Australia`
- Website: `https://yezyy.com`
- Do not publish a personal email address unless the user separately requests it.

## Profile README

The profile README must stay within roughly one and a half desktop screens and use this order:

1. A short introduction establishing full-stack direction and Melbourne location.
2. One featured case study: YezYY.
3. Four to six concise engineering highlights covering the bilingual public site, customer booking and party flows, staff administration, capacity and availability rules, server-side business logic, automated testing, and production deployment.
4. Live website and source links.
5. A compact stack table grouped into frontend, backend, data, testing, and delivery.
6. A brief current-focus or contact line.

The README must not claim that public shopping or online payment is available. It must not present closed product-shopping entry points as a current customer flow.

## YezYY repository README

The repository README must read as an engineering case study rather than a technology inventory.

### Opening

- Use the product name `YezYY` consistently.
- Describe it as a production bilingual booking and operations platform for an operating DIY studio in Glen Waverley, Melbourne.
- Link to `https://yezyy.com` and the public API health endpoint.
- Add one current production homepage screenshot stored in a focused documentation asset directory rather than the repository root.

### Product and operational scope

Describe only currently supported behaviour:

- English and Chinese customer routes.
- Ordinary DIY booking requests and party requests.
- Capacity-aware availability in the `Australia/Melbourne` timezone.
- Human confirmation and in-store payment.
- Customer rescheduling and cancellation flows.
- A protected Chinese staff administration experience for bookings, schedules, catalogue content, gallery content, parties, settings, and users.
- Product-shopping entry points are intentionally disabled at the current business stage.

Remove or revise outdated statements that present the cart, public commerce, or online order flow as active production features.

### Engineering evidence

Keep concise sections for:

- Architecture and repository layout.
- Important engineering decisions.
- Server-authoritative validation and business rules.
- Test and release-gate commands.
- Production deployment topology.
- Local setup.

Do not expose environment values, owner credentials, internal customer data, recovery codes, or secret-bearing examples. Do not add a GitHub Actions badge while the repository is not using Actions as the authoritative delivery signal.

## Repository metadata

Set the repository description to:

`Production bilingual booking and operations platform for a Melbourne DIY studio — Next.js, Fastify, and PostgreSQL.`

Set the homepage to:

`https://yezyy.com`

Use a focused topic set:

- `typescript`
- `nextjs`
- `fastify`
- `postgresql`
- `drizzle-orm`
- `monorepo`
- `booking-system`
- `bilingual`
- `docker`
- `vercel`
- `flyio`

## Visual direction

Use one current, readable production screenshot near the top of the YezYY README. Avoid decorative GIFs and multiple near-duplicate screenshots. The screenshot must show the real production UI without private admin data, customer details, or browser chrome containing account information.

## Safety and verification

Before external changes:

- Confirm the working tree is clean and the branch is suitable for the README change.
- Confirm the current reachable Git object list does not contain `recovery-codes.txt`; the read-only check on 2026-08-03 found no matching path.
- Do not reveal or reconstruct any historical secret material.

After implementation:

- Verify the profile as a public visitor would see it.
- Verify Birthday Sky is private and no longer appears publicly.
- Verify YezYY is the only pinned project.
- Verify the live website and API health links resolve.
- Verify all public copy is English and uses `YezYY` consistently.
- Verify the README does not describe closed shopping or online-payment capabilities as active.
- Verify repository description, homepage, and topics match this specification.

## Out of scope

- Rewriting application code or business functionality.
- Enabling product shopping or online payment.
- Publishing personal contact details.
- Deleting practice repositories.
- Adding invented performance metrics, user counts, revenue figures, testimonials, or employer claims.
