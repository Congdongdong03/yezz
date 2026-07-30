CREATE TABLE "catalogue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" jsonb NOT NULL,
	"duration_display" jsonb NOT NULL,
	"occasion_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"availability_note" jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"cover_image_url" text,
	"image_kind" varchar(32) DEFAULT 'placeholder' NOT NULL,
	"image_source_url" text,
	"image_license_url" text,
	"image_attribution" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalogue_entries_slug_unique" UNIQUE("slug"),
	CONSTRAINT "catalogue_entries_image_kind_valid" CHECK ("catalogue_entries"."image_kind" IN ('yezyy', 'inspiration', 'placeholder'))
);
--> statement-breakpoint
CREATE TABLE "catalogue_entry_projects" (
	"catalogue_entry_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"label" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "catalogue_entry_projects_catalogue_entry_id_project_id_pk" PRIMARY KEY("catalogue_entry_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "catalogue_entries" ADD CONSTRAINT "catalogue_entries_category_id_project_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."project_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_entry_projects" ADD CONSTRAINT "catalogue_entry_projects_catalogue_entry_id_catalogue_entries_id_fk" FOREIGN KEY ("catalogue_entry_id") REFERENCES "public"."catalogue_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_entry_projects" ADD CONSTRAINT "catalogue_entry_projects_project_id_diy_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."diy_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalogue_entries_published_sort_order_idx" ON "catalogue_entries" USING btree ("published","sort_order");--> statement-breakpoint
CREATE INDEX "catalogue_entry_projects_entry_sort_order_idx" ON "catalogue_entry_projects" USING btree ("catalogue_entry_id","sort_order");