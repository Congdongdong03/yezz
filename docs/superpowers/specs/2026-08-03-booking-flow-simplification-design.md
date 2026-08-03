# YezYY Booking Flow Simplification Design

**Date:** 2026-08-03  
**Status:** Approved by the user in chat  
**Scope:** Public ordinary DIY booking and party request experiences only

## Goal

Reduce selection pressure, repeated explanations, and unnecessary form density without changing YezYY's server-authoritative booking rules. Ordinary DIY and party requests remain manual-confirmation workflows with in-store payment. Product requests remain disabled.

## Non-negotiable business behaviour

- Ordinary DIY requests stay at four logical steps: projects, attendance, date/time, and contact/policy.
- Capacity, age, supervision, two-hour lead time, seven-day horizon, waitlist behaviour, and Melbourne time remain enforced by the API.
- Party requests remain for 4–8 DIY participants and 1–2 accompanying parents.
- Party venue fees remain A$95 or A$145, paid in store after confirmation and before the party date.
- Policy acceptance remains required. Photo permission remains optional and defaults to declined.
- Existing API payloads, idempotency, emails, admin review, customer management links, and database records remain unchanged.

## Ordinary DIY booking

### Project selection

Keep the four top-level DIY categories. Within air-dry cream piping, divide the current catalogue into five bilingual display groups:

1. Quick & small
2. Storage
3. Home & office
4. Phone accessories
5. Medium & large

Each group initially shows up to three projects in the existing catalogue order. A bilingual `Show more` / `Show less` control reveals or collapses additional projects. Selected projects must never disappear when a group collapses. Categories without a subgroup mapping keep the existing compact project list. `Decide in store` remains a separate, clearly labelled choice.

The grouping is presentation-only and is keyed from the stable canonical English project names already seeded in the live catalogue. Unknown future items fall into a bilingual `More choices` group rather than disappearing.

### Attendance

Show one age statement above the controls and one capacity summary below them. Do not repeat the same capacity hint for every field. The accompanying-adult control remains available because all people physically present must count toward capacity. The stronger supervision message appears only when the number of children aged 5–8 is greater than zero.

### Date and time

Show one instruction above the time grid explaining that the times below can be requested and require manual confirmation. Available slots display compact start-time buttons such as `10:00`; their accessible names retain the full start/end interval and confirmation meaning. Waitlist slots keep a visible waitlist label because that difference changes the request outcome.

### Contact, policy, and photo permission

The final required contact fields are name, phone, and email. Remove the general notes field from the ordinary flow. Replace the seven-item policy summary and duplicate contact block with three concise bilingual rules:

1. The request is not confirmed until staff confirms it.
2. Payment is in store; there is no online payment.
3. Minimum age is 5, maximum physical attendance is 8, and arrival more than 20 minutes late may require rearrangement.

Keep links to Booking Terms, Cancellation & Rescheduling, and Privacy Policy plus the required acceptance checkbox.

Photo permission starts as a single optional disclosure with declined selected. The adult/minor options and signer-name field appear only after the customer chooses to consider granting permission. Collapsing it resets the decision to declined and clears the signer name.

## Party page and request form

### Marketing page

Keep the hero payment/deposit explanation as the single prominent explanation. Package cards show package name, guest-use duration, venue fee, attendance, minimum spend, included setup/cleanup, and the request action. Remove the repeated time-request paragraph from each card and remove the duplicate payment/deposit information card below the packages. The FAQ may answer payment or confirmation questions on demand because it is collapsed by default.

### Three-step party request

The selected package summary remains visible. The form becomes a three-step progressive flow:

1. **People:** contact name, phone, email, birthday child's name and age, DIY participant count, and accompanying parent count.
2. **Plan:** project interests, preferred date, and preferred guest start. Project interests include `Not sure yet`; selecting it clears other interests, and selecting a concrete interest clears it.
3. **Extras & terms:** what the party will bring, conditional cake-cutting service, special requirements, optional photo permission, policy links, and required acceptance.

Only the current step is visible. Back/Continue controls preserve entered values. Step validation happens when the customer tries to continue; the form must not show untouched errors. The final submit revalidates all steps and preserves existing server error behaviour.

Cake-cutting appears only when `Cake` is selected. Turning Cake off also clears cake-cutting. BYO values and the existing API payload remain unchanged.

## Accessibility and responsive behaviour

- All expand/collapse controls expose `aria-expanded` and reference the controlled region.
- Hidden steps and conditional controls are removed from the accessibility tree.
- Keyboard focus moves to the first invalid field within the current step.
- Time buttons remain at least 44px high, with visible focus and selected states.
- Mobile keeps one-column cards and compact time grids without horizontal overflow.

## Error handling

- Availability load/retry, stale-slot refresh, server validation, and submission errors retain their current behaviour.
- Project, attendance, party-step, photo-signer, and policy errors appear only after the related action is attempted.
- A server-side party validation error returns the customer to the step containing the first invalid field.

## Verification

- Add focused component tests for cream-piping grouping and expansion, attendance copy, compact time buttons, compact policy consent, collapsed photo permission, party step navigation, `Not sure yet`, and conditional cake cutting.
- Update existing ordinary and party form tests without weakening API payload assertions.
- Run typecheck, web/API/database tests, production builds, isolated PostgreSQL booking tests, and the full desktop/mobile closure E2E suite.
- Visually inspect English and Chinese ordinary booking and party flows at desktop and mobile widths before deployment.

## Out of scope

- Product or cart work
- Admin workflow changes
- API, schema, booking-policy, pricing, capacity, or email configuration changes
- New project photography or catalogue content
