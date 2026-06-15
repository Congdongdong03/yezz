ALTER TYPE "user_role" ADD VALUE 'staff';

CREATE TABLE IF NOT EXISTS "time_slots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "start_time" varchar(8) NOT NULL,
  "end_time" varchar(8) NOT NULL,
  "capacity" integer NOT NULL,
  "booked_count" integer DEFAULT 0 NOT NULL,
  "category_id" uuid,
  "is_available" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_category_id_project_categories_id_fk"
  FOREIGN KEY ("category_id") REFERENCES "public"."project_categories"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "time_slot_id" uuid;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "locale" varchar(8);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "is_read" boolean DEFAULT false NOT NULL;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_slot_id_time_slots_id_fk"
  FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "cart_orders" ADD COLUMN IF NOT EXISTS "is_read" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "cart_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
