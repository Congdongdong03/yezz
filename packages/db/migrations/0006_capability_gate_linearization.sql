LOCK TABLE "site_settings" IN ACCESS EXCLUSIVE MODE;
WITH "ranked_settings" AS (
	SELECT
		"id",
		row_number() OVER (
			ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
		) AS "singleton_rank",
		bool_and("experience_requests_enabled") OVER () AS "experience_enabled",
		bool_and("party_requests_enabled") OVER () AS "party_enabled",
		bool_and("product_requests_enabled") OVER () AS "product_enabled"
	FROM "site_settings"
),
"folded_capabilities" AS (
	UPDATE "site_settings" AS "settings"
	SET
		"experience_requests_enabled" = "ranked_settings"."experience_enabled",
		"party_requests_enabled" = "ranked_settings"."party_enabled",
		"product_requests_enabled" = "ranked_settings"."product_enabled"
	FROM "ranked_settings"
	WHERE
		"settings"."id" = "ranked_settings"."id"
		AND "ranked_settings"."singleton_rank" = 1
	RETURNING "settings"."id"
)
DELETE FROM "site_settings" AS "settings"
USING "ranked_settings"
WHERE
	"settings"."id" = "ranked_settings"."id"
	AND "ranked_settings"."singleton_rank" > 1;
ALTER TABLE "site_settings" ADD COLUMN "singleton_key" boolean DEFAULT true NOT NULL;
CREATE UNIQUE INDEX "site_settings_singleton_key_unique" ON "site_settings" USING btree ("singleton_key");
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_singleton_key_true" CHECK ("site_settings"."singleton_key" = true);
