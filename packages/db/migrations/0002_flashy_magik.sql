CREATE TYPE "public"."order_status" AS ENUM('new', 'contacted', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(64) NOT NULL,
	"wechat" varchar(128),
	"email" varchar(255),
	"preferred_date" varchar(32),
	"number_of_people" integer,
	"activity_type" varchar(32),
	"interested_project" varchar(255),
	"message" text,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"project_id" uuid,
	"project_name" jsonb,
	"project_type" "project_type",
	"style_name" jsonb,
	"date" varchar(32),
	"people" integer,
	"price" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(64) NOT NULL,
	"wechat" varchar(128),
	"message" text,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_order_items" ADD CONSTRAINT "cart_order_items_order_id_cart_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."cart_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_order_items" ADD CONSTRAINT "cart_order_items_project_id_diy_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."diy_projects"("id") ON DELETE set null ON UPDATE no action;