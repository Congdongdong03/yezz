# Admin Password Recovery Design

## Goal

Let an administrator who cannot sign in request a secure, one-time password reset link from the admin login flow.

## User flow

The login page links to `/admin/forgot-password`. The administrator enters an email address and submits it. The page always shows the same success message: if the address belongs to an admin account, a reset link has been sent and expires in one hour. The link opens the existing `/admin/setup-password?token=...` page, where the administrator chooses a new password of at least 12 characters.

## Security and data flow

The web app forwards the same-origin request to a new public API endpoint. The API normalizes the email, applies both IP and IP-plus-email durable rate limits, and calls the existing password setup service. Issuance is serialized per account, existing tokens are revoked, and the new token is stored only as a SHA-256 digest. The email outbox stores an authenticated encrypted envelope; the worker decrypts it only in memory immediately before sending the one-hour, one-use link. Completing the reset increments the user's session version so prior sessions become invalid.

The API returns the same response for existing, missing, malformed, and temporarily failed requests. A minimum response-time floor reduces timing-based account discovery. Delivery/storage failures are logged server-side but are not exposed to the requester.

## Scope

- Add the public recovery API endpoint and service behavior.
- Allow the endpoint through the signed same-origin web proxy.
- Add an admin recovery page and a link from the login page.
- Reuse the existing password setup page and email template.
- Keep booking, party, and product request switches closed.

## Verification

Unit tests cover normalization, token issuing, non-enumerating responses, rate limits, proxy allowlisting, and the recovery page states. Release verification and a live browser check must pass before the feature is reported complete.
