ALTER TABLE "email_outbox" DROP CONSTRAINT "email_outbox_exactly_one_request";--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_exactly_one_request" CHECK ((
        ("email_outbox"."message_type" = 'admin_password_setup'
          AND num_nonnulls("email_outbox"."booking_id", "email_outbox"."cart_order_id") = 0
          AND "email_outbox"."status_event_id" IS NULL)
        OR
        ("email_outbox"."message_type" <> 'admin_password_setup'
          AND num_nonnulls("email_outbox"."booking_id", "email_outbox"."cart_order_id") = 1)
      ));