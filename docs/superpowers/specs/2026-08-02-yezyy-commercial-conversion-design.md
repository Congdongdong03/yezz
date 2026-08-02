# YezYY Commercial Conversion Design

**Date:** 2026-08-02  
**Status:** Proposed for owner review  
**Scope:** Public trust, booking conversion, and operational-risk foundations  

## Goal

Move YezYY from a visually polished but partly placeholder-led website to a credible local DIY studio website that:

- helps customers understand and request an experience quickly;
- reduces repetitive questions for staff;
- preserves the verified manual-confirmation and pay-in-store workflows;
- presents the real Glen Waverley studio accurately;
- keeps product shopping disabled.

## Fixed Business Rules

- Brand name: YezYY.
- Location: G082/235 Springvale Rd, Glen Waverley VIC 3150.
- Public content remains bilingual; the admin remains Chinese.
- Ordinary DIY and party requests remain open.
- Product shopping and product requests remain closed.
- Bookings remain requests until staff manually confirms them.
- Payment remains in store. No online-payment integration is included.
- For parties, the A$95 or A$145 venue fee is also the deposit. The customer must visit YezYY and pay it in store before the party date; it is not collected on the party day.
- Existing server-side capacity, availability, reminders, secure customer actions, email outbox, and admin workflows remain authoritative.

## Delivery Sequence

The work is split into three independently releasable rounds. Each round keeps the live booking flow usable.

### Round 1 — Real Studio Trust Layer

#### Homepage

- Replace the empty hero treatment with a real YezYY studio or storefront photograph.
- Keep the soft rose-and-white visual system and current typography.
- Show four activity families with concise price/duration cues.
- Add a real-studio section using the existing storefront, interior, DIY table, and materials-wall photographs.
- Add a mobile sticky action bar for booking, calling, and directions.
- Do not add invented reviews, customer counts, awards, or performance claims.

#### Projects

- Keep the current catalogue and server-backed booking handoff.
- Use accurate YezYY activity photographs when available.
- If an accurate activity image is unavailable, use a neutral labelled inspiration image rather than presenting it as the actual finished product.
- Move third-party media attribution away from each project card into a quiet media-credits surface where the applicable licence permits this.

#### Gallery

- Organise content into studio, making process, finished pieces, and consent-approved community moments.
- Use real YezYY images first.
- Never show identifiable customers, especially children, without appropriate permission.
- Remove development-style empty copy once enough real studio/process images are available.

#### Contact

- Replace the placeholder panel with the real storefront image.
- Keep the map, address, phone, email, hours, and Xiaohongshu details.
- Add a short arrival cue using a mall-entrance or wayfinding photo if supplied.

#### Parties

- Add real empty-room or staged party-setup photographs.
- Keep the existing package rules and request workflow.
- Add a concise FAQ covering group size, supervision, food, setup, confirmation, payment, cancellation, and overtime.
- Explain clearly that the requested party time is not finally secured until the customer pays the venue-fee deposit in store before the party date.
- Keep the exact payment deadline staff-controlled until the owner defines a fixed deadline.

### Round 2 — Short Mobile Booking Funnel

Replace the long all-at-once booking page with progressive disclosure:

1. choose an activity/project;
2. choose participants and accompanying adults;
3. choose an available Melbourne date and start time;
4. enter contact details, review the summary, and accept linked policies.

Requirements:

- A project-detail booking action preselects that project.
- The global booking action starts with activity-family choices rather than every project quantity control.
- Validation appears after a relevant interaction or attempted continuation, not on initial page load.
- A persistent summary shows selected project, people, duration, price, date, and time.
- “Decide in store” remains an explicit option and reserves its existing duration.
- Submission still uses the current API and server-side validation.
- Success shows the reference, request-not-confirmed status, next steps, address, and contact methods.

### Round 3 — Risk and Measurement Foundations

- Add bilingual Privacy Policy, Booking Terms, Cancellation and Rescheduling Policy, and Party Terms pages.
- Link the booking acceptance control to the relevant policies.
- Add the registered legal entity and ABN only after the owner supplies verified details.
- Configure GA4 and Search Console; preserve the existing consent-safe analytics behaviour.
- Track project view, booking start, step progression, validation failure, and successful request without collecting form contents.
- Add application error monitoring, uptime monitoring, failed-email alerts, and a documented database backup/restore check.
- Treat policy text as operational copy requiring owner review; it must not claim to remove Australian Consumer Law rights.

## Media Shot List

Existing supplied storefront and interior photographs will be reused. The minimum useful new set is:

1. **Hero:** one clean horizontal 16:9 photograph of the studio interior or storefront.
2. **Activity process:** two close-ups each for deco cream, plaster painting, beading, and melty beads; hands only is sufficient.
3. **Party:** one wide setup, one decorated table, one eight-seat layout, and one cake/gift area.
4. **Arrival:** one shopping-centre entrance or wayfinding photograph if customers commonly have trouble finding the unit.
5. **Optional team:** one friendly staff or owner photograph, only if desired.

Individual product photographs are helpful but are not a blocker for Round 1.

## Photo Capture Guidance

- Send original JPG, HEIC, or PNG files; avoid screenshots, filters, watermarks, and messaging-app compression where possible.
- Clean the phone lens and use the normal 1× camera in even light.
- Capture both horizontal 16:9 and vertical 4:5 versions when convenient.
- Remove visible customer names, booking sheets, screens, and other personal information from the frame.
- Avoid identifiable children unless a parent or guardian has approved the website use.
- Prefer neutral craft areas for hero imagery so the website does not imply affiliation with third-party character brands.

## Quality and Release Gates

- No horizontal overflow at 390 px.
- Keyboard focus, form labels, reduced motion, and meaningful image alt text remain intact.
- No public mutation bypasses the server-authoritative APIs.
- Ordinary and party request E2E tests pass in English and Chinese.
- Existing capacity, manual confirmation, pay-in-store, reminder, cancellation, and rescheduling tests remain green.
- Product request capability remains off in production.
- Each round receives desktop and mobile visual review before deployment.

## Explicitly Out of Scope

- Online product shopping.
- Online payments.
- Membership, loyalty points, gift cards, or customer accounts.
- AI chat, live chat, or unnecessary animation.
- Invented testimonials or customer imagery.
- Automatic expiry of an unpaid party hold before the owner defines the fixed in-store payment deadline.
