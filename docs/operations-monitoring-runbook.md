# YezYY operations and growth setup

The code is safe when the optional service credentials are absent. Complete the
following account-side steps before relying on production alerts.

## Analytics and search

1. Create a GA4 property for `https://yezyy.com` and set
   `NEXT_PUBLIC_GA_ID=G-...`. Booking funnel events already include project
   views, booking starts and successful submissions.
2. Add `https://yezyy.com` to Google Search Console. Copy only the value from
   the `google-site-verification` tag into
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and deploy.
3. Submit `https://yezyy.com/sitemap.xml`. Keep the Google Business Profile
   address, phone, hours and photos consistent with the website.

## Error monitoring

1. Create separate Sentry projects for the web application and API.
2. Configure the web deployment with `NEXT_PUBLIC_SENTRY_DSN`,
   `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`.
3. Configure the API with server-only `SENTRY_DSN`. Set both environments to
   `production`; keep the default trace sample rate at `0.05` initially.
4. Trigger a controlled test error in a non-production environment and verify
   that no customer name, email, phone or secure management token is attached.

## Availability and failed email alerts

- Fly checks `/health` every 30 seconds. It returns 503 when PostgreSQL or Redis
  is unavailable.
- Configure an external monitor to request `/health/operations` every 5 minutes.
  It returns 503 when infrastructure is unavailable, a delivery is marked
  failed, or queued email has been stalled for more than 15 minutes.
- Route external monitor and Sentry alerts to the owner. The Chinese admin email
  delivery page remains the place to inspect and retry a failed message.

## Database backups

1. Enable the database provider's automatic daily backups and documented
   retention before opening live booking.
2. Run `BACKUP_DATABASE_URL='...' pnpm check:backup` weekly. The check creates an
   encrypted-connection custom-format dump in a temporary directory, verifies
   that PostgreSQL can read its catalogue and then deletes the local dump.
3. At least monthly, restore a recent provider backup into a separate
   non-production database and run the booking database closure tests against
   that restored copy. Never test restoration over production.
4. Record the check date, operator, backup timestamp and restore result in the
   operations log.
