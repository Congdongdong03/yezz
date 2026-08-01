UPDATE "password_setup_tokens"
SET "revoked_at" = COALESCE("revoked_at", now())
WHERE "used_at" IS NULL AND "revoked_at" IS NULL;
--> statement-breakpoint
UPDATE "email_outbox"
SET
  "payload" = "payload" - 'setupUrl',
  "delivery_status" = CASE
    WHEN "delivery_status" IN ('pending', 'processing') THEN 'failed'
    ELSE "delivery_status"
  END,
  "last_error" = CASE
    WHEN "delivery_status" IN ('pending', 'processing')
      THEN 'Legacy password setup link revoked during security upgrade'
    ELSE "last_error"
  END,
  "lease_expires_at" = NULL,
  "updated_at" = now()
WHERE
  "message_type" = 'admin_password_setup'
  AND "payload" ? 'setupUrl';
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_no_raw_password_setup_url" CHECK ("email_outbox"."message_type" <> 'admin_password_setup' OR NOT ("email_outbox"."payload" ? 'setupUrl'));
