# YezYY Admin Mobile Booking Queue Design

**Date:** 2026-08-02

**Scope:** Responsive presentation of the existing Chinese admin booking queue

## Problem

The booking queue is currently rendered as a table with a minimum width of 960px. That works on a desktop, but store staff using a phone must drag horizontally to find the customer, schedule, status, email state, and action controls. The workflow is already functionally complete; the next release should make the same workflow usable at the counter on a phone without changing booking rules or API behavior.

## Chosen Approach

Render the same booking collection in two responsive presentations:

- below the `md` breakpoint, show one compact work card per booking;
- at `md` and above, retain the existing full table;
- both presentations use the same labels, formatters, action list, dialog, mutation handler, pagination, filters, stale-state recovery, and API calls.

This is preferred over merely adding sticky columns because a nine-column table remains difficult to scan on a phone. A separate mobile route was rejected because it would duplicate workflow state and raise the chance of desktop and mobile behavior diverging.

## Mobile Card Information Order

Each card presents the information in the order a staff member needs it:

1. unread marker, request kind, and current status;
2. customer name and submission time;
3. tappable phone and email;
4. selected offering, requested date and time, attendance, and policy version;
5. email delivery state and any failure count;
6. valid workflow actions and a full-width detail link.

The card does not expose new actions. `bookingActionsFor(kind, status)` remains the single source of truth for available transitions.

## Component Boundaries

- `lib/admin/booking-queue.ts` owns Chinese queue labels and pure formatting helpers used by both mobile and desktop presentations.
- `components/admin/BookingQueueCard.tsx` owns only the mobile visual composition and delegates actions through callbacks.
- `app/admin/bookings/page.tsx` continues to own filtering, loading, mutations, dialogs, refreshes, pagination, and focus recovery.

## Responsive and Accessibility Rules

- Mobile cards are visible below `md`; the table is visible from `md` upward.
- The mobile list has an accessible queue label and each card has a customer-specific heading.
- Phone and email remain real `tel:` and `mailto:` links.
- Action buttons keep customer-specific accessible names.
- Loading, empty, error, filtering, pagination, and stale-state focus behavior are unchanged.

## Error Handling

The card uses the existing workflow dialog. Inline validation, localized API errors, idempotent operation IDs, stale-status refresh, and disabled submitting state therefore behave identically on desktop and mobile.

## Testing

- Pure helper tests cover offering, attendance, and delivery summaries.
- Component tests cover information hierarchy, contact links, valid actions, disabled state, and the detail link.
- Page tests prove the mobile queue and desktop table coexist and that a card action opens the existing workflow dialog.
- The existing admin booking, API booking, PostgreSQL booking, and browser closure suites remain green.

## Explicit Non-Goals

- No booking API or database changes.
- No new status or business policy.
- No product or cart changes.
- No redesign of unrelated admin screens.
- No change to the public booking flow.
