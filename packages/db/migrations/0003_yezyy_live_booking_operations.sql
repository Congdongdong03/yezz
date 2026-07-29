ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE varchar(32) USING "status"::text;--> statement-breakpoint
UPDATE "bookings" SET "status" = CASE "status"
  WHEN 'new' THEN 'pending_review'
  WHEN 'contacted' THEN 'pending_review'
  WHEN 'confirmed' THEN 'confirmed'
  WHEN 'cancelled' THEN 'cancelled'
  ELSE "status"
END;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "participant_count" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "young_child_count" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "accompanying_adult_count" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "attendance_count" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "policy_version" varchar(32);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "policy_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_valid" CHECK ("bookings"."status" IN ('pending_review', 'confirmed', 'waitlisted', 'rejected', 'time_proposed', 'awaiting_in_store_payment', 'confirmed_paid', 'payment_expired', 'reschedule_requested', 'cancellation_requested', 'cancelled', 'refunded', 'no_show', 'completed'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ordinary_attendance_range" CHECK ("bookings"."request_kind" <> 'experience' OR "bookings"."attendance_count" IS NULL OR "bookings"."attendance_count" BETWEEN 1 AND 8);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_duration_positive" CHECK ("bookings"."duration_minutes" IS NULL OR "bookings"."duration_minutes" > 0);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(16) USING "role"::text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'staff';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_valid" CHECK ("users"."role" IN ('owner', 'admin', 'staff'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_session_version_nonnegative" CHECK ("users"."session_version" >= 0);--> statement-breakpoint
DROP TYPE "user_role";--> statement-breakpoint
ALTER TABLE "diy_projects" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "diy_projects" ADD COLUMN "bookable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "diy_projects" ADD COLUMN "variant_selected_in_store" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "diy_projects" ADD COLUMN "extra_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "diy_projects" ADD COLUMN "extra_time_price_cents" integer;--> statement-breakpoint
ALTER TABLE "diy_projects" ADD CONSTRAINT "diy_projects_cents_nonnegative" CHECK (("diy_projects"."price_min" IS NULL OR "diy_projects"."price_min" >= 0) AND ("diy_projects"."price_max" IS NULL OR "diy_projects"."price_max" >= 0) AND ("diy_projects"."extra_time_price_cents" IS NULL OR "diy_projects"."extra_time_price_cents" >= 0));--> statement-breakpoint
ALTER TABLE "diy_projects" ADD CONSTRAINT "diy_projects_duration_positive" CHECK (("diy_projects"."duration_minutes" IS NULL OR "diy_projects"."duration_minutes" > 0) AND ("diy_projects"."extra_time_minutes" IS NULL OR "diy_projects"."extra_time_minutes" > 0));--> statement-breakpoint
ALTER TABLE "party_packages" ADD COLUMN "guest_duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "party_packages" ADD COLUMN "setup_minutes" integer;--> statement-breakpoint
ALTER TABLE "party_packages" ADD COLUMN "cleanup_minutes" integer;--> statement-breakpoint
ALTER TABLE "party_packages" ADD COLUMN "venue_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "party_packages" ADD COLUMN "min_spend_per_person_cents" integer;--> statement-breakpoint
ALTER TABLE "party_packages" ADD COLUMN "min_parents" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "party_packages" ADD COLUMN "max_parents" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "party_packages" ADD CONSTRAINT "party_packages_cents_nonnegative" CHECK (("party_packages"."venue_fee_cents" IS NULL OR "party_packages"."venue_fee_cents" >= 0) AND ("party_packages"."min_spend_per_person_cents" IS NULL OR "party_packages"."min_spend_per_person_cents" >= 0));--> statement-breakpoint
ALTER TABLE "party_packages" ADD CONSTRAINT "party_packages_duration_positive" CHECK (("party_packages"."guest_duration_minutes" IS NULL OR "party_packages"."guest_duration_minutes" > 0) AND ("party_packages"."setup_minutes" IS NULL OR "party_packages"."setup_minutes" > 0) AND ("party_packages"."cleanup_minutes" IS NULL OR "party_packages"."cleanup_minutes" > 0));--> statement-breakpoint
ALTER TABLE "party_packages" ADD CONSTRAINT "party_packages_parents_range" CHECK ("party_packages"."min_parents" BETWEEN 1 AND 2 AND "party_packages"."max_parents" BETWEEN "party_packages"."min_parents" AND 2);--> statement-breakpoint
ALTER TABLE "request_status_events" DROP CONSTRAINT "request_status_events_from_status_valid";--> statement-breakpoint
ALTER TABLE "request_status_events" DROP CONSTRAINT "request_status_events_to_status_valid";--> statement-breakpoint
ALTER TABLE "request_status_events" ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "request_status_events" ADD COLUMN "actor_kind" varchar(16) DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_from_status_valid" CHECK ("request_status_events"."from_status" IN ('new', 'contacted', 'pending_review', 'confirmed', 'waitlisted', 'rejected', 'time_proposed', 'awaiting_in_store_payment', 'confirmed_paid', 'payment_expired', 'reschedule_requested', 'cancellation_requested', 'cancelled', 'refunded', 'no_show', 'completed'));--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_to_status_valid" CHECK ("request_status_events"."to_status" IN ('new', 'contacted', 'pending_review', 'confirmed', 'waitlisted', 'rejected', 'time_proposed', 'awaiting_in_store_payment', 'confirmed_paid', 'payment_expired', 'reschedule_requested', 'cancellation_requested', 'cancelled', 'refunded', 'no_show', 'completed'));--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_actor_kind_valid" CHECK ("request_status_events"."actor_kind" IN ('staff', 'customer', 'system'));--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "experience_requests_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "party_requests_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "product_requests_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"project_id" uuid,
	"project_name_snapshot" jsonb,
	"unit_price_cents_snapshot" integer,
	"duration_minutes_snapshot" integer NOT NULL,
	"quantity" integer NOT NULL,
	"decide_in_store" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "booking_items_duration_positive" CHECK ("booking_items"."duration_minutes_snapshot" > 0),
	CONSTRAINT "booking_items_quantity_positive" CHECK ("booking_items"."quantity" > 0),
	CONSTRAINT "booking_items_unit_price_nonnegative" CHECK ("booking_items"."unit_price_cents_snapshot" IS NULL OR "booking_items"."unit_price_cents_snapshot" >= 0)
);--> statement-breakpoint
CREATE TABLE "booking_party_details" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"birthday_child_name" varchar(255) NOT NULL,
	"birthday_child_age" integer NOT NULL,
	"participant_count" integer NOT NULL,
	"parent_count" integer NOT NULL,
	"desired_date" date NOT NULL,
	"desired_start_time" varchar(5) NOT NULL,
	"byo_cake" boolean DEFAULT false NOT NULL,
	"byo_drinks" boolean DEFAULT false NOT NULL,
	"byo_food" boolean DEFAULT false NOT NULL,
	"byo_snacks" boolean DEFAULT false NOT NULL,
	"cake_cutting_requested" boolean DEFAULT false NOT NULL,
	"special_requirements" text,
	"final_date" date,
	"final_setup_start" varchar(5),
	"final_guest_start" varchar(5),
	"final_guest_end" varchar(5),
	"final_cleanup_end" varchar(5),
	"venue_fee_cents" integer NOT NULL,
	"min_spend_per_person_cents" integer NOT NULL,
	"payment_deadline" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_amount_cents" integer,
	"refunded_at" timestamp with time zone,
	CONSTRAINT "booking_party_details_participants_range" CHECK ("booking_party_details"."participant_count" BETWEEN 4 AND 8),
	CONSTRAINT "booking_party_details_parents_range" CHECK ("booking_party_details"."parent_count" BETWEEN 1 AND 2),
	CONSTRAINT "booking_party_details_cents_nonnegative" CHECK ("booking_party_details"."venue_fee_cents" >= 0 AND "booking_party_details"."min_spend_per_person_cents" >= 0 AND ("booking_party_details"."paid_amount_cents" IS NULL OR "booking_party_details"."paid_amount_cents" >= 0)),
	CONSTRAINT "booking_party_details_time_format" CHECK ("booking_party_details"."desired_start_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND ("booking_party_details"."final_setup_start" IS NULL OR "booking_party_details"."final_setup_start" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$') AND ("booking_party_details"."final_guest_start" IS NULL OR "booking_party_details"."final_guest_start" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$') AND ("booking_party_details"."final_guest_end" IS NULL OR "booking_party_details"."final_guest_end" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$') AND ("booking_party_details"."final_cleanup_end" IS NULL OR "booking_party_details"."final_cleanup_end" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'))
);--> statement-breakpoint
CREATE TABLE "booking_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"type" varchar(24) NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_charges_amount_nonnegative" CHECK ("booking_charges"."amount_cents" >= 0),
	CONSTRAINT "booking_charges_type_valid" CHECK ("booking_charges"."type" IN ('venue_fee', 'cake_cutting', 'cleaning', 'overtime', 'refund'))
);--> statement-breakpoint
CREATE TABLE "customer_action_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_action_tokens_token_digest_unique" UNIQUE("token_digest")
);--> statement-breakpoint
CREATE TABLE "password_setup_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_setup_tokens_token_digest_unique" UNIQUE("token_digest")
);--> statement-breakpoint
CREATE TABLE "studio_weekly_hours" (
	"weekday" integer PRIMARY KEY NOT NULL,
	"opens_at" varchar(5) NOT NULL,
	"closes_at" varchar(5) NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "studio_weekly_hours_weekday_range" CHECK ("studio_weekly_hours"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "studio_weekly_hours_time_format" CHECK ("studio_weekly_hours"."opens_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "studio_weekly_hours"."closes_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "studio_weekly_hours"."opens_at" < "studio_weekly_hours"."closes_at")
);--> statement-breakpoint
CREATE TABLE "studio_special_hours" (
	"date" date PRIMARY KEY NOT NULL,
	"opens_at" varchar(5),
	"closes_at" varchar(5),
	"is_closed" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "studio_special_hours_whole_day_closure" CHECK (("studio_special_hours"."is_closed" AND "studio_special_hours"."opens_at" IS NULL AND "studio_special_hours"."closes_at" IS NULL) OR (NOT "studio_special_hours"."is_closed" AND "studio_special_hours"."opens_at" IS NOT NULL AND "studio_special_hours"."closes_at" IS NOT NULL)),
	CONSTRAINT "studio_special_hours_time_format" CHECK ("studio_special_hours"."opens_at" IS NULL OR ("studio_special_hours"."opens_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "studio_special_hours"."closes_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "studio_special_hours"."opens_at" < "studio_special_hours"."closes_at"))
);--> statement-breakpoint
CREATE TABLE "studio_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"start_time" varchar(5),
	"end_time" varchar(5),
	"note" text,
	CONSTRAINT "studio_closures_whole_day_null_pair" CHECK (("studio_closures"."start_time" IS NULL AND "studio_closures"."end_time" IS NULL) OR ("studio_closures"."start_time" IS NOT NULL AND "studio_closures"."end_time" IS NOT NULL)),
	CONSTRAINT "studio_closures_time_format" CHECK ("studio_closures"."start_time" IS NULL OR ("studio_closures"."start_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "studio_closures"."end_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "studio_closures"."start_time" < "studio_closures"."end_time"))
);--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_project_id_diy_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."diy_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_party_details" ADD CONSTRAINT "booking_party_details_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_charges" ADD CONSTRAINT "booking_charges_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_charges" ADD CONSTRAINT "booking_charges_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_action_tokens" ADD CONSTRAINT "customer_action_tokens_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_setup_tokens" ADD CONSTRAINT "password_setup_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "studio_weekly_hours" ("weekday", "opens_at", "closes_at") VALUES
	(0, '10:00', '17:00'),
	(1, '09:30', '17:00'),
	(2, '09:30', '17:00'),
	(3, '09:30', '17:00'),
	(4, '09:30', '20:30'),
	(5, '09:30', '20:30'),
	(6, '09:30', '17:30')
ON CONFLICT DO NOTHING;
