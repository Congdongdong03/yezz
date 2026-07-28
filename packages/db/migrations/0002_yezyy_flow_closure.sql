DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "time_slots"
		WHERE "capacity" < 1
			OR "booked_count" < 0
			OR "booked_count" > "capacity"
			OR "start_time" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
			OR "end_time" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
			OR "start_time" >= "end_time"
	) THEN
		RAISE EXCEPTION 'Invalid legacy time_slots: capacity/time invariants violated';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "time_slots"
		GROUP BY
			"date",
			"start_time",
			"end_time",
			COALESCE("category_id", '00000000-0000-0000-0000-000000000000'::uuid)
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Invalid legacy time_slots: duplicate effective slots exist';
	END IF;
END
$$;
--> statement-breakpoint
CREATE TABLE "admin_request_reads" (
	"user_id" uuid NOT NULL,
	"booking_id" uuid,
	"cart_order_id" uuid,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_request_reads_exactly_one_request" CHECK (num_nonnulls("admin_request_reads"."booking_id", "admin_request_reads"."cart_order_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedupe_key" varchar(255) NOT NULL,
	"booking_id" uuid,
	"cart_order_id" uuid,
	"status_event_id" uuid,
	"message_type" varchar(64) NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"locale" varchar(8) NOT NULL,
	"payload" jsonb NOT NULL,
	"delivery_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"provider_message_id" varchar(255),
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_delivery_status_valid" CHECK ("email_outbox"."delivery_status" IN ('pending', 'processing', 'sent', 'failed')),
	CONSTRAINT "email_outbox_attempt_count_nonnegative" CHECK ("email_outbox"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "request_rate_limits" (
	"scope" varchar(64) NOT NULL,
	"subject_hash" varchar(64) NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "request_rate_limits_pk" PRIMARY KEY("scope","subject_hash","window_started_at"),
	CONSTRAINT "request_rate_limits_count_positive" CHECK ("request_rate_limits"."request_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "request_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"cart_order_id" uuid,
	"operation_id" uuid NOT NULL,
	"from_status" varchar(32) NOT NULL,
	"to_status" varchar(32) NOT NULL,
	"admin_note" text,
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_status_events_exactly_one_request" CHECK (num_nonnulls("request_status_events"."booking_id", "request_status_events"."cart_order_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_time_slot_id_time_slots_id_fk";
--> statement-breakpoint
ALTER TABLE "diy_projects" ALTER COLUMN "price_currency" SET DEFAULT 'AUD';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "request_kind" varchar(32) DEFAULT 'experience' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "party_package_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "offering_name_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "offering_price_snapshot" varchar(128);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "slot_date" date;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "slot_start_time" varchar(8);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "slot_end_time" varchar(8);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "slot_timezone" varchar(64) DEFAULT 'Australia/Melbourne' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_order_items" ADD COLUMN "style_id" uuid;--> statement-breakpoint
ALTER TABLE "cart_order_items" ADD COLUMN "price_currency" varchar(10) DEFAULT 'AUD' NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "time_slot_id" uuid;--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "number_of_people" integer;--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "preferred_date" date;--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "slot_date" date;--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "slot_start_time" varchar(8);--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "slot_end_time" varchar(8);--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "slot_timezone" varchar(64) DEFAULT 'Australia/Melbourne' NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "locale" varchar(8);--> statement-breakpoint
ALTER TABLE "cart_orders" ADD COLUMN "idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
UPDATE "bookings" AS b
SET
	"request_kind" = 'experience',
	"idempotency_key" = COALESCE(b."idempotency_key", gen_random_uuid()),
	"slot_date" = COALESCE(b."slot_date", t."date", b."preferred_date"),
	"slot_start_time" = COALESCE(b."slot_start_time", t."start_time"),
	"slot_end_time" = COALESCE(b."slot_end_time", t."end_time"),
	"slot_timezone" = COALESCE(b."slot_timezone", 'Australia/Melbourne')
FROM "time_slots" AS t
WHERE b."time_slot_id" = t."id";--> statement-breakpoint
UPDATE "bookings"
SET
	"idempotency_key" = COALESCE("idempotency_key", gen_random_uuid()),
	"slot_date" = COALESCE("slot_date", "preferred_date"),
	"slot_timezone" = COALESCE("slot_timezone", 'Australia/Melbourne');--> statement-breakpoint
UPDATE "cart_orders"
SET
	"idempotency_key" = COALESCE("idempotency_key", gen_random_uuid()),
	"slot_timezone" = COALESCE("slot_timezone", 'Australia/Melbourne');--> statement-breakpoint
UPDATE "diy_projects"
SET "price_currency" = 'AUD'
WHERE "price_currency" IS NULL;--> statement-breakpoint
ALTER TABLE "admin_request_reads" ADD CONSTRAINT "admin_request_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_request_reads" ADD CONSTRAINT "admin_request_reads_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_request_reads" ADD CONSTRAINT "admin_request_reads_cart_order_id_cart_orders_id_fk" FOREIGN KEY ("cart_order_id") REFERENCES "public"."cart_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_cart_order_id_cart_orders_id_fk" FOREIGN KEY ("cart_order_id") REFERENCES "public"."cart_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_status_event_id_request_status_events_id_fk" FOREIGN KEY ("status_event_id") REFERENCES "public"."request_status_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_cart_order_id_cart_orders_id_fk" FOREIGN KEY ("cart_order_id") REFERENCES "public"."cart_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_request_reads_booking_unique" ON "admin_request_reads" USING btree ("user_id","booking_id") WHERE "admin_request_reads"."booking_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_request_reads_cart_order_unique" ON "admin_request_reads" USING btree ("user_id","cart_order_id") WHERE "admin_request_reads"."cart_order_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_dedupe_key_unique" ON "email_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "email_outbox_booking_id_idx" ON "email_outbox" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "email_outbox_cart_order_id_idx" ON "email_outbox" USING btree ("cart_order_id");--> statement-breakpoint
CREATE INDEX "email_outbox_status_event_id_idx" ON "email_outbox" USING btree ("status_event_id");--> statement-breakpoint
CREATE INDEX "email_outbox_delivery_due_idx" ON "email_outbox" USING btree ("delivery_status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "request_rate_limits_expires_at_idx" ON "request_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "request_status_events_operation_id_unique" ON "request_status_events" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "request_status_events_booking_id_idx" ON "request_status_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "request_status_events_cart_order_id_idx" ON "request_status_events" USING btree ("cart_order_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_project_id_diy_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."diy_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_party_package_id_party_packages_id_fk" FOREIGN KEY ("party_package_id") REFERENCES "public"."party_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_order_items" ADD CONSTRAINT "cart_order_items_style_id_project_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."project_styles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_orders" ADD CONSTRAINT "cart_orders_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_idempotency_key_unique" ON "bookings" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_orders_idempotency_key_unique" ON "cart_orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "time_slots_effective_slot_unique" ON "time_slots" USING btree ("date","start_time","end_time",COALESCE("category_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_request_kind_valid" CHECK ("bookings"."request_kind" IN ('experience', 'party'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_kind_parent_consistent" CHECK (("bookings"."project_id" IS NULL AND "bookings"."party_package_id" IS NULL) OR ("bookings"."request_kind" = 'experience' AND "bookings"."project_id" IS NOT NULL AND "bookings"."party_package_id" IS NULL) OR ("bookings"."request_kind" = 'party' AND "bookings"."project_id" IS NULL AND "bookings"."party_package_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_exactly_one_request" CHECK (num_nonnulls("email_outbox"."booking_id", "email_outbox"."cart_order_id") = 1);--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_from_status_valid" CHECK ("request_status_events"."from_status" IN ('new', 'contacted', 'confirmed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_to_status_valid" CHECK ("request_status_events"."to_status" IN ('new', 'contacted', 'confirmed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_capacity_positive" CHECK ("time_slots"."capacity" >= 1);--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_booked_nonnegative" CHECK ("time_slots"."booked_count" >= 0);--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_booked_within_capacity" CHECK ("time_slots"."booked_count" <= "time_slots"."capacity");--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_time_format" CHECK ("time_slots"."start_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "time_slots"."end_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_time_order" CHECK ("time_slots"."start_time" < "time_slots"."end_time");
