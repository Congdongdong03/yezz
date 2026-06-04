ALTER TABLE "diy_projects" ADD COLUMN IF NOT EXISTS "price_min" integer;
ALTER TABLE "diy_projects" ADD COLUMN IF NOT EXISTS "price_max" integer;
ALTER TABLE "diy_projects" ADD COLUMN IF NOT EXISTS "price_currency" varchar(10) DEFAULT 'CNY';
ALTER TABLE "cart_orders" ADD COLUMN IF NOT EXISTS "email" varchar(255);
