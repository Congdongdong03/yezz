# YezYY Four-Step Booking Conversion Plan

## Goal

Make the ordinary DIY request feel light and guided without changing the server-authoritative booking, capacity, waitlist, manual-confirmation, or in-store-payment rules.

## Customer flow

1. Choose one DIY category and one or more projects, or choose a clearly separate "Decide in store" option.
2. Enter DIY participants, children aged 5–8, and accompanying adults.
3. Choose an available or waitlist date and start time.
4. Enter contact details and accept the booking rules before submitting.

Only the active step is expanded. Back and Continue controls preserve the customer's choices. Validation messages remain hidden until the customer interacts with a field or tries to continue/submit.

## Persistent summary

A sticky summary remains above the active step and shows:

- selected project names, or "Decide in store";
- DIY participants and total people attending;
- estimated longest project duration;
- estimated AUD price when all selected projects have a known price, otherwise a clear in-store price message;
- selected date and time once chosen.

## Project discovery

- Add category identity to the booking project view model.
- Show category tabs first.
- Render only projects in the active category.
- A catalogue detail link continues to pass a server-validated `project` query parameter; the wizard opens with that project and category selected.
- "Decide in store" remains outside the project grid as a visually distinct choice and reserves 60 minutes, matching the existing backend snapshot.

## Success state

After a successful request, show:

- the canonical booking reference returned from the created ID and timestamp;
- whether the request is a booking or waitlist request;
- the requested date/time and project summary;
- the next step: wait for manual confirmation by email or phone before travelling;
- in-store payment wording;
- the Glen Waverley address and contact details.

## Safety constraints

- Keep all availability checks and the final fresh-slot recheck.
- Keep idempotency attempt reuse.
- Do not change capacity, age, supervision, lead-time, horizon, waitlist, or payment rules.
- Keep product requests and product navigation closed.
- Preserve English and Chinese parity.

## Verification

- Component tests prove category filtering, delayed validation, step order, sticky summary, preselection, decide-in-store, and success reference.
- Existing action and booking tests prove the payload remains unchanged.
- Closure E2E proves catalogue preselection and the full ordinary booking lifecycle on desktop and mobile.
