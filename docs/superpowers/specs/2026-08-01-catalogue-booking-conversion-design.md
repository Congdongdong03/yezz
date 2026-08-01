# YezYY Catalogue-to-Booking Conversion Design

**Date:** 2026-08-01
**Status:** Approved through delegated product autonomy
**Scope:** Public project detail and ordinary DIY booking handoff

## 1. Goal

Turn the existing public catalogue into a complete ordinary-DIY request path:

1. a customer opens a project detail;
2. chooses a specific bookable size or style;
3. enters the ordinary booking page with that project already assigned to one participant;
4. may change the project, quantity, attendance, and time before submitting;
5. receives the existing manual-confirmation and pay-in-store outcome.

This iteration uses existing catalogue, project, pricing, and request-capability data. It does not require new photos, policies, prices, social links, or business copy from YezYY.

## 2. Current Problem

The ordinary request capability is live, but the public catalogue detail route passes `requestEnabled={false}` unconditionally. Customers can browse a project but see the closed-request contact fallback instead of a booking action. The booking form also has no supported initial project selection, so a catalogue choice cannot survive navigation to `/book`.

## 3. Chosen Approach

Use a server-authoritative deep link:

- The project detail route loads the same live site capability used by `/book`.
- When ordinary requests are enabled, every bookable catalogue variant links to `/{locale}/book?project=<project-id>`.
- The booking page accepts the query value only when it matches an available, bookable ordinary-DIY project returned by the server.
- A valid match initializes one project for one participant. The customer remains free to change quantities or choose a different project.
- Invalid, stale, hidden, or non-bookable identifiers are ignored. The normal empty booking form remains usable.
- When ordinary requests are disabled, the existing phone/email fallback remains visible and no booking link is rendered.

This is preferred over a client-only shared store because a URL is shareable, resilient to refresh, and does not trust browser state. It is preferred over adding a second booking form to project details because one canonical form keeps validation and policy handling consistent.

## 4. Interface Design

### Project detail

- Keep the existing image, facts, pricing, duration, and availability layout.
- For each bookable variant, add a clear bilingual action: `Book this option` / `预约此选项`.
- For a single-variant entry, the action still sits beside that variant so the selected operational project is explicit.
- Add a short factual note above the actions: requests are manually confirmed and payment happens in store.
- Preserve the contact fallback when the experience gate is closed.

### Booking form

- A valid project deep link initializes its quantity to `1`.
- The initial attendance remains one DIY participant, so project and participant counts agree immediately.
- The selected project card is visibly highlighted by the existing picker state.
- The customer can change or remove the preselection before choosing a date.
- The rest of the four-step booking flow and all policies remain unchanged.

## 5. Data and Safety Rules

- `requestCapabilities.experience` remains the only public enablement authority.
- The query string never bypasses the server-provided bookable-project list.
- Catalogue variant identifiers are preserved; prices and durations come from existing API data.
- Product ordering remains disabled and untouched.
- Party booking, capacity, hours, two-hour lead time, seven-day horizon, 30-minute starts, manual confirmation, and in-store payment remain unchanged.
- No database migration or production data rewrite is required.

## 6. Analytics and Accessibility

- Track catalogue project views, booking-intent clicks, and successful ordinary request submission only when Google Analytics is configured.
- Links and controls retain visible keyboard focus.
- Action labels name the selected variant and remain meaningful to screen readers.
- English and Chinese copy communicate the same action and payment model.

## 7. Error Handling

- Invalid or unavailable `project` query values are ignored without exposing internal identifiers or blocking the booking page.
- Catalogue-data or settings failures continue to use the existing service-unavailable treatment.
- A capability disabled between page view and submission remains protected by the existing server-side request gate.
- Existing booking validation and stale-slot handling remain authoritative.

## 8. Verification

- Component tests prove open and closed project-detail states.
- Page tests prove capability wiring and valid/invalid query handling.
- Booking-form tests prove valid initial selection and customer editability.
- Browser tests cover project detail to preselected booking on desktop and mobile, plus a closed-gate regression.
- Full typecheck, lint, unit, API, PostgreSQL closure, browser closure, and production build must pass.
- Post-deployment checks confirm ordinary and party requests stay enabled, product remains disabled, and the live project-detail bundle contains the new handoff.

## 9. Out of Scope

- New project photos or catalogue records
- Online payment, product ordering, inventory, or delivery
- New cancellation, age, attendance, or party policies
- Admin visual redesign
- Changes to booking state transitions or email timing
