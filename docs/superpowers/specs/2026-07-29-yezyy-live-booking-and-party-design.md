# YezYY Live DIY Booking and Party Operations Design

## Status

Approved in conversation on 2026-07-29.

This design extends the existing YezYY production system. Where it conflicts with an earlier design, this document is authoritative for the live ordinary-DIY, waitlist, party, notification, and staff-operation workflows. In particular:

- an ordinary DIY request does not reserve capacity until staff confirms it;
- an approved party temporarily holds its final staff-selected time until the staff-selected payment deadline;
- the new operational sender is `bookings@yezyy.com`, with replies delivered to `congdongdong03@gmail.com`;
- the ordinary DIY, party, and product capability flags remain off until the owner gives a final explicit instruction to open them.

## Purpose

Turn the existing deployed YezYY website and Chinese admin into a safe operating system for a real Melbourne DIY studio. The system must close the loop from customer request through manual confirmation, in-store payment, attendance, cancellation, rescheduling, waitlisting, and completion without adding online payments or rebuilding the application.

## Chosen Approach

Extend the current web application, API, database, deployment, and Chinese admin with focused booking modules:

- booking policy and availability;
- overlapping-capacity calculation;
- ordinary DIY requests and line items;
- waitlist handling;
- exclusive party requests and temporary payment holds;
- customer self-service request links;
- bilingual email notifications;
- structured business hours and closures;
- staff-visible audit and email-delivery records.

A generic contact-form-only system was rejected because it cannot reliably enforce capacity or close the operational loop. A full scheduling-platform rewrite was rejected as unnecessary for one studio with a maximum ordinary-DIY occupancy of eight.

## Canonical Business Information

- Brand: `YezYY`
- Website: `https://yezyy.com`
- Address: `G082/235 Springvale Rd, Glen Waverley VIC 3150`
- Phone: `0430 787 712`
- Operational contact and reply-to email: `congdongdong03@gmail.com`
- Email sender: `bookings@yezyy.com`
- Xiaohongshu ID: `95848743904`
- Currency: AUD
- Time zone: `Australia/Melbourne`
- Customer website languages: English and Simplified Chinese
- Admin language: Simplified Chinese
- Online payment: not offered
- Ordinary DIY payment: in store
- Party venue fee/deposit payment: in store before the event

## Weekly Business Hours

| Day | Hours |
| --- | --- |
| Monday | 9:30 am–5:00 pm |
| Tuesday | 9:30 am–5:00 pm |
| Wednesday | 9:30 am–5:00 pm |
| Thursday | 9:30 am–8:30 pm |
| Friday | 9:30 am–8:30 pm |
| Saturday | 9:30 am–5:30 pm |
| Sunday | 10:00 am–5:00 pm |

All availability, deadlines, reminders, and date calculations use Melbourne local time, including daylight-saving transitions.

## Shared Booking Rules

- Customers may request dates from the current Melbourne date through seven calendar days ahead.
- The requested start must be at least two hours in the future.
- Customer-facing start times use 30-minute increments.
- An activity must finish no later than the day's closing time.
- Minimum customer age is four.
- Children aged four through eight require adult supervision.
- Customers aged nine or older may attend ordinary DIY without an accompanying adult.
- The customer must accept the bilingual booking, age/supervision, cancellation, and privacy terms before submission.
- Submission creates a request, not a confirmed booking.
- Staff confirmation is always required.
- There is no online payment.
- The public website, emails, and customer links use the locale selected on the original form.

## Ordinary DIY Catalogue and Reservation Durations

The DIY service catalogue is operational booking content, not an e-commerce product catalogue. Customers may choose projects in advance or select `Decide in store`.

### Air-dry cream piping

Small projects reserve 30 minutes:

- two hair clips — $18;
- fridge magnet — $18;
- mini drawers — $32;
- hair claw — $32;
- car decoration stand — $38.

Other air-dry cream-piping projects reserve 60 minutes:

- medium storage box/drawers — $65;
- large storage box/drawers — $98;
- glass dome — $98;
- extra-large drawer — $197;
- pen holder, one face — $50;
- extra face — $33;
- mug — $65;
- lamp — from $43, final variant selected in store;
- mirror — $87;
- notebook — $87;
- pencil case — $65;
- phone case — from $66, final variant selected in store;
- phone stand — $76;
- phone socket — $32;
- small bag to decorate — $65;
- large bag to decorate — $109;
- water bottle — $88.

### Melty bead craft

- $49.50 for one hour;
- additional time is $16.50 per 30 minutes;
- the booking reserves 60 minutes initially;
- the photographed `50% off` sign is temporary and must not be presented as a permanent promotion.

### Paint clay figurine

- mini — $19.80;
- small — $27.50;
- medium — $38.50;
- large — $54;
- each booking reserves 60 minutes.

### Beading

- the public booking option is `Beading — from $43`;
- the specific phone strap, bracelet, or other variant is selected in store;
- expected making time is approximately 20 minutes;
- capacity is reserved for one 30-minute interval.

### Group duration

A group may choose different projects and quantities. Its capacity interval runs from the common start time through the longest selected project duration. `Decide in store` reserves 60 minutes.

## Ordinary DIY Capacity

- At most eight people may be physically present for ordinary DIY at any moment.
- Participating customers and non-participating accompanying adults both count toward the limit.
- Availability is calculated from overlapping half-open intervals: `[start, end)`.
- Only confirmed ordinary DIY bookings consume ordinary capacity.
- Pending requests do not consume capacity and therefore cannot block the studio through spam or abandoned forms.
- Staff confirmation rechecks current capacity inside the same database transaction that changes the status.
- If confirmation would exceed capacity, the action is rejected and staff must offer another time or move the request to the waitlist.
- Party temporary holds and confirmed parties block all ordinary DIY capacity for their full staff-defined occupied interval.

## Ordinary DIY Customer Flow

1. The customer selects a date, 30-minute start, actual total attendance, project quantities, and optional notes.
2. The form separately records:
   - contact name;
   - email;
   - phone;
   - participating people;
   - children aged four through eight;
   - accompanying adults;
   - selected project quantities or `Decide in store`.
3. The client displays an availability preview, but the server remains authoritative.
4. The customer accepts the policies and submits one idempotent request.
5. The request enters `pending_review`; it does not reserve capacity.
6. The customer receives a same-locale request-received email.
7. Staff confirms, offers another time, rejects, or waitlists the request.
8. Confirmation reserves capacity and sends the final confirmation email.
9. A confirmed booking created more than 24 hours before its start receives one reminder 24 hours before the start. A later confirmation does not receive a catch-up reminder.
10. The customer pays at the studio.
11. More than 20 minutes late means the original time is no longer guaranteed and staff may rearrange the customer.
12. Staff closes the record as `completed` or `no_show`.

## Waitlist Flow

- When an interval is full, the public page offers `Join the waitlist`.
- A waitlist request records the same contact, attendance, project, date, start, locale, and policy acceptance details.
- Waitlist requests do not consume capacity.
- Staff contacts a customer manually when capacity becomes available.
- After contact and agreement, staff converts the waitlist request to a confirmed booking.
- Conversion performs the same transactional capacity check as ordinary confirmation.
- The system never promotes a waitlist request automatically.

## Ordinary DIY Cancellation and Rescheduling

- The customer uses an expiring secure email link to submit a cancellation or rescheduling request.
- Staff makes the final change.
- A request made at least two hours before the start is eligible for free cancellation or rescheduling.
- A request made less than two hours before the start is handled at staff discretion.
- There is no cancellation fee.
- A customer who does not contact the store and does not arrive is marked `no_show`.

## Party Rules

### Attendance and supervision

- Minimum four and maximum eight participating DIY guests.
- Every participant must choose at least one DIY project.
- Minimum DIY spend is $45 per participating guest.
- One or two accompanying parents are required for the party as a whole.
- Accompanying parents do not count toward the four-to-eight participant limit and are not required to spend.
- A party may therefore contain up to eight participants plus two accompanying parents.
- Minimum participant age is four.
- Participants aged four through eight require parent supervision.

### Packages

| Package | Guest use | Venue fee/deposit |
| --- | ---: | ---: |
| Standard | 1.5 hours | $95 |
| Extended | 2.5 hours | $145 |

The $95 or $145 amount is both the venue fee and the deposit. It is not the participants' DIY spend.

Staff accounts for a default 30-minute setup block before and a default 30-minute cleanup block after the guest-use period. The website collects a desired guest start in 30-minute increments. Staff may approve the desired time or propose a different time and is responsible for selecting the final full occupied interval. Setup or cleanup may occur outside public opening hours when staff approves it.

### Included

- birthday setup and decorations;
- a surprise gift for the birthday child, selected by staff from a plush toy, Lego set, or toy;
- a 15% in-store voucher, excluding Pop Mart, venue fees, and booking-related charges.

### Food and additional charges

- Customers may bring cake, drinks, food, and snacks.
- Staff cake-cutting service is $15.
- BYO food/snack cleaning is $15–$35, set by staff according to quantity and cleanup.
- Party overtime of 15–30 minutes costs $15–$35, decided by staff on the day.
- The public page displays ranges accurately and does not calculate variable charges automatically.

### Party request and payment flow

1. The customer chooses a package, desired date and 30-minute start, four-to-eight participants, one-to-two parents, birthday-child details, projects, BYO intentions, optional cake cutting, and special requirements.
2. The customer accepts the policies and submits an idempotent party request.
3. The request enters `pending_review` and sends a same-locale acknowledgement.
4. Staff reviews the full occupied interval and all ordinary DIY, party, closure, and business-hour conflicts.
5. Staff accepts the desired time or proposes a final time and sets a payment deadline.
6. If staff accepts the customer's requested time, the request may move directly to `awaiting_in_store_payment`. If staff proposes a different time, the customer accepts it through the scoped email link, or staff records the customer's agreement after direct contact.
7. Moving to `awaiting_in_store_payment` creates a temporary exclusive hold through the staff-selected deadline.
8. The customer visits the studio and pays the $95 or $145 venue fee/deposit.
9. Staff records payment and changes the party to `confirmed_paid`; the exclusive interval becomes final.
10. If the payment deadline passes first, the system changes the party to `payment_expired`, releases the temporary hold, and sends an email.
11. Staff records optional charges, attendance, and final completion in the admin. No payment is processed by the website.

### Party exclusivity

A temporary party hold or confirmed party blocks:

- every ordinary DIY booking;
- every other party;
- every waitlist conversion;

for the final full interval selected by staff, including setup and cleanup.

### Party cancellation and refunds

- A cancellation at least 48 hours before the final party guest start is eligible for a full refund of the $95 or $145 venue fee/deposit.
- A cancellation less than 48 hours before the final party guest start is non-refundable.
- Customers request cancellation or rescheduling through the secure email link.
- Staff decides and records the result.
- Refunds are performed outside the website and recorded by staff as operational data.

## State Models

### Ordinary DIY and waitlist

Internal states and Chinese admin labels:

| Internal state | Chinese label |
| --- | --- |
| `pending_review` | 待确认 |
| `confirmed` | 已确认 |
| `waitlisted` | 候补 |
| `rejected` | 已拒绝 |
| `reschedule_requested` | 申请改期 |
| `cancellation_requested` | 申请取消 |
| `cancelled` | 已取消 |
| `no_show` | 未到店 |
| `completed` | 已完成 |

### Party

| Internal state | Chinese label |
| --- | --- |
| `pending_review` | 待审核 |
| `time_proposed` | 待客户接受时间 |
| `awaiting_in_store_payment` | 待到店付款 |
| `confirmed_paid` | 已付款并确认 |
| `payment_expired` | 付款逾期 |
| `rejected` | 已拒绝 |
| `reschedule_requested` | 申请改期 |
| `cancellation_requested` | 申请取消 |
| `cancelled` | 已取消 |
| `refunded` | 已退款 |
| `no_show` | 未到店 |
| `completed` | 已完成 |

All transitions use explicit server-side rules. Invalid transitions return a conflict response and do not partially update capacity, holds, audit events, or email work.

## Chinese Admin Design

### Owner account

- Create one `Owner` account for `congdongdong03@gmail.com`.
- Send a password-setup or password-reset link to that email.
- Never place a password in chat, source code, logs, or an email body.
- Require the account owner to choose the password through the secure flow.

### Dashboard and calendar

The Chinese admin shows:

- today and the next seven days;
- ordinary DIY requests;
- parties;
- waitlist requests;
- cancellation and rescheduling requests;
- parties awaiting in-store payment;
- payment deadlines;
- actual occupied people and remaining ordinary capacity by interval;
- party and closure conflict warnings;
- notification delivery problems.

### Staff actions

Staff can:

- confirm, reject, cancel, complete, or mark no-show;
- move an ordinary request to the waitlist;
- convert a waitlist request after contacting the customer;
- propose and record a final time;
- set or change a party payment deadline;
- record in-store party payment;
- record refund eligibility and completion;
- record cake cutting, cleaning, overtime, and other manual charges;
- review the customer-provided policy acknowledgements;
- resend a failed customer email;
- review the complete status and action history.

### Business settings

Staff can:

- edit weekly hours;
- close a whole date;
- close a date/time range;
- define special hours for a date;
- control ordinary DIY, party, and product public capability flags independently.

Adding a closure that overlaps an existing booking produces a blocking warning or explicit override confirmation. It never silently cancels or edits an existing customer record.

## Public Website Design

- English and Chinese pages use the canonical YezYY identity and business details.
- Ordinary DIY content displays the approved real prices and expected durations.
- Beading displays `From $43`.
- The temporary melty-bead discount is not represented as permanent.
- No fictional catalogue, fake customer work, or stock photography is presented as YezYY work.
- Until genuine project photos are available, use clean branded text cards and honest image-empty states.
- The party page clearly presents:
  - package prices and guest durations;
  - participant and parent limits;
  - $45 minimum project spend per participant;
  - inclusions;
  - BYO rules;
  - additional charge ranges;
  - in-store payment;
  - cancellation and refund rules.
- Forms include clear loading, no-availability, stale-slot, submission-error, and success states.
- All forms are usable on mobile and desktop and meet the existing application's accessibility standard.
- Product sales and product-request entry points remain out of scope and disabled.

## Required Customer Data

Ordinary DIY collects:

- contact name;
- email;
- phone;
- participating count;
- count of children aged four through eight;
- accompanying-adult count;
- selected project quantities or `Decide in store`;
- desired date and start;
- optional notes;
- locale;
- versioned policy acknowledgements.

Party additionally collects:

- birthday child's name and age;
- selected package;
- participant count;
- parent count;
- desired date and guest start;
- project interests;
- BYO cake, drink, food, and snack intentions;
- cake-cutting request;
- special requirements.

Sensitive values are visible only to authorised staff and the customer through a valid scoped token.

## Architecture

The implementation keeps the current web, API, database, and deployment boundaries. It adds focused services rather than a universal scheduling rewrite:

- `booking-policy`: window, lead time, age, attendance, and policy validation;
- `availability`: Melbourne-local slot generation, closures, finish-before-close, overlap, and capacity;
- `ordinary-booking-workflow`: ordinary state transitions and capacity effects;
- `party-workflow`: final-time proposal, exclusive holds, payment deadlines, and refund records;
- `waitlist-workflow`: creation and staff-controlled conversion;
- `notification-outbox`: durable bilingual email work and retry state;
- `customer-action-token`: scoped expiring access for time-proposal acceptance, cancellation, and rescheduling;
- `booking-maintenance`: reminders and expired party holds;
- `audit-log`: immutable staff and system events.

Each unit exposes an explicit service interface and does not rely on UI state for validation.

## Data Design

Reuse the existing booking, status-event, capability, admin-user, and email-outbox models where they already provide the required behaviour. Add forward-compatible migrations for missing fields or related tables.

The persistent model must represent:

- request type: ordinary DIY, party, or waitlist;
- customer and locale;
- participant, young-child, and accompanying-adult counts;
- project line items and duration snapshots;
- desired and final Melbourne-local intervals;
- capacity attendance count;
- party setup, guest-use, and cleanup intervals;
- party payment deadline, paid-at time, and recorded amount;
- party additional charge records;
- cancellation/refund decision and timestamps;
- current state and immutable state events;
- versioned policy acknowledgements;
- idempotency key;
- secure customer-action token digest, permitted action scope, and expiry;
- email-delivery attempts and errors;
- staff/system audit events;
- weekly hours, dated special hours, and closures.

Price and duration snapshots are stored on the request so future catalogue edits do not change historical bookings.

## Concurrency and Consistency

- Create operations use an idempotency key so retries or double-clicks return one request.
- Capacity confirmation, waitlist conversion, party-hold creation, hold expiry, cancellation, and rescheduling run in database transactions.
- The service locks or otherwise serialises the affected date/interval before recalculating availability.
- Status updates use compare-and-set semantics to reject stale admin screens.
- Email outbox records are committed with the state change, then delivered asynchronously.
- A failed email never rolls back a valid booking state and never creates a duplicate booking.
- Scheduled maintenance operations are idempotent and safe to retry.

## Notifications

### Customer

Send same-locale email for:

- request received;
- confirmed;
- rejected;
- waitlist recorded;
- waitlist converted;
- alternative time proposed;
- awaiting in-store party payment with deadline;
- payment recorded and party confirmed;
- payment deadline expired;
- cancellation request received and resolved;
- rescheduling request received and resolved;
- 24-hour reminder when eligible.

Every applicable message includes the scoped customer-management link. No message claims a request is confirmed before its confirmed state.

### Staff

Notify `congdongdong03@gmail.com` for:

- new ordinary DIY request;
- new party request;
- new waitlist request;
- customer cancellation request;
- customer rescheduling request;
- repeated notification-delivery failure.

### Sender

- From: `YezYY Bookings <bookings@yezyy.com>`
- Reply-To: `congdongdong03@gmail.com`

The sender domain must be verified before notifications are enabled in production.

## Error Handling

- Revalidate availability at submission and every capacity-affecting staff action.
- If a displayed slot becomes stale, return alternatives and the waitlist option.
- Reject invalid attendance, age/supervision, lead-time, horizon, closing-time, project, or policy data with same-locale field errors.
- Reject duplicate or stale staff transitions without partial side effects.
- Show expired or revoked customer links as safe generic pages without customer data.
- Queue and retry temporary email failures; expose terminal failure to staff.
- Preserve the booking success result when only asynchronous email delivery fails.
- Rate-limit public create and customer-link operations using the existing production-safe controls.
- Log internal detail with request correlation IDs while public errors remain generic and localised.

## Testing

### Unit coverage

- Melbourne date boundaries and daylight-saving transitions;
- current-day two-hour lead time;
- seven-calendar-day horizon;
- 30-minute start generation;
- finish-before-close logic;
- special hours and partial closures;
- 30- and 60-minute project duration calculation;
- longest-project group duration;
- ordinary overlap and eight-person physical-attendance limit;
- pending requests not consuming capacity;
- party temporary and confirmed exclusivity;
- age, supervision, participant, and parent rules;
- cancellation and refund thresholds;
- allowed and rejected status transitions;
- notification locale and template wording.

### Integration coverage

- idempotent request creation;
- transactional ordinary confirmation under concurrent attempts;
- transactional waitlist conversion;
- party hold creation and automatic expiry;
- rescheduling and capacity release/reacquisition;
- email outbox creation, retry, and staff-visible failure;
- customer token scope, expiry, and revocation;
- admin authorisation and audit events.

### End-to-end coverage

Run the following in English and Chinese where customer-facing:

- ordinary DIY request through staff confirmation and completion;
- stale slot through waitlist submission and staff conversion;
- mixed-project group using the longest duration;
- party request through time proposal, in-store payment record, and completion;
- party payment expiry and slot release;
- cancellation and rescheduling through the secure customer link;
- temporary closure and special-hours behaviour;
- mobile and desktop form use;
- all capability-off states.

No automated test creates records in the production database.

## Rollout and Launch Gate

1. Implement and verify migrations, API services, web forms, Chinese admin, notifications, and maintenance jobs.
2. Create the Owner account through the secure email setup flow.
3. Verify `bookings@yezyy.com` sender-domain DNS and delivery.
4. Seed only the approved real DIY service content and party rules.
5. Run automated tests and local/staging end-to-end checks.
6. Deploy with ordinary DIY, party, and product capability flags off.
7. Run production smoke tests only against disabled public entry points and non-mutating health/read checks.
8. Remove any non-production test data.
9. Report readiness to the owner.
10. Open ordinary DIY and party together only after the owner gives a new explicit instruction to open them.

Product entry remains disabled.

## Out of Scope

- online payments or payment-card collection;
- SMS notifications;
- automatic booking confirmation;
- automatic waitlist promotion;
- automatic calculation or collection of variable party charges;
- product sales and product-request workflow;
- staff scheduling or payroll;
- multiple locations;
- customer accounts or passwords;
- publishing fake, stock, or AI-generated work as real YezYY project photography;
- permanent promotion of the photographed temporary melty-bead sale.

## Acceptance Criteria

The design is implemented only when:

- ordinary DIY, waitlist, and party flows close from request through final staff status;
- availability is server-authoritative and cannot confirm more than eight physical ordinary-DIY attendees;
- exclusive party holds and confirmed parties prevent all overlapping bookings;
- all agreed age, attendance, timing, payment, cancellation, refund, and pricing rules are enforced or clearly presented;
- customer and staff notifications are durable, bilingual where required, and truthful about confirmation;
- the Chinese admin can operate every state without database or command-line access;
- private data, customer links, admin authentication, rate limits, and audit events pass security tests;
- mobile, desktop, English, and Chinese end-to-end checks pass;
- the deployment remains gated off until explicit owner approval.
