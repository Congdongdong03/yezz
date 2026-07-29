# Request-Log Hardening Report

## Outcome

Request logging now handles malformed query-key encoding without throwing and
redacts customer bearer tokens when the token path segment is percent encoded.
The same decoded-path match is used by the standard Fastify request serializer
and the internal signed-request protection hook.

No booking, schedule, email, capability gate, UI, database, deployment, or
production configuration was changed.

## Root Cause

- `safeQuery` called `decodeURIComponent` directly on every query key. A request
  such as `GET /probe?%ZZ=x` therefore raised `URIError` from Pino's Fastify
  request serializer and left the request unresolved.
- Both the path redactor and `protectedPath` matched only the raw URL. Fastify
  decoded `%2D` in a route parameter to a valid leading `-`, while those raw
  matchers missed it. The recoverable encoded bearer token reached standard
  request logs, and internal pre-parsing verification was skipped.

## TDD Evidence

The focused regression suite was run before production changes and failed in
all three intended ways:

- the malformed-query request timed out after 5 seconds and Vitest reported an
  unhandled `URIError: URI malformed`;
- the encoded token appeared verbatim in the real Fastify request log;
- the encoded internal GET returned 503 because signed-request protection did
  not recognize the path.

After the fix, the focused suite passed all 5 tests. It now covers:

- a real `GET /probe?%ZZ=x` request completing with HTTP 200 while logging
  `%ZZ=[REDACTED]`;
- a real Fastify GET log containing only the `:token` route label for
  `%2D` plus 42 base64url characters;
- independent standard and internal-verification log assertions for customer
  GET, cancellation, time acceptance, and reschedule requests;
- retained non-sensitive query evidence and redacted `signature`, `token`, and
  `secret` query values.

## Implementation

- Added a non-throwing percent-decoder that returns a failure sentinel.
- Added one shared customer-booking path matcher. It validates the decoded
  43-character bearer segment, redacts the complete raw segment, and recognizes
  only the current customer action suffixes for internal request protection.
- Changed malformed query keys to fail closed: their raw key remains available
  as operational evidence, but their value is replaced with `[REDACTED]`.
- Replaced the duplicate raw customer-path regex in `internal-request.ts` with
  the shared matcher.

## Verification

- `vitest run src/lib/request-log-redaction.test.ts` — 1 file, 5 tests passed.
- `vitest run src/lib/request-log-redaction.test.ts src/lib/internal-request.test.ts src/routes/v1/customer-bookings.routes.test.ts`
  — 3 files, 21 tests passed.
- Full default API `vitest run` — 46 files and 322 tests passed; 16 files and
  156 dedicated-database tests skipped by their existing opt-in guards.
- API `tsc --noEmit` — passed.
- `git diff --check` — passed.
