-- =============================================================
-- ERP service database (DDL)
-- Engine: PostgreSQL 13+ (gen_random_uuid() is built in)
-- Owned exclusively by the ERP microservice (database-per-service).
--
-- Cross-service references (no FK, the data lives in another database):
--   stock_movements.user_id, sales.user_id, sale_history.user_id -> auth.users.id
--
-- Note: updated_at defaults only apply on INSERT. It is refreshed on every
-- UPDATE by the application layer (Prisma @updatedAt).
-- =============================================================

CREATE TYPE "product_units" AS ENUM (
  'Unit',
  'Kg',
  'Meter',
  'Liter'
);

CREATE TYPE "type_movements" AS ENUM (
  'Income',
  'Outcome',
  'Adjustment'
);

CREATE TYPE "sale_states" AS ENUM (
  'Ordered',
  'Paid',
  'Dispatched',
  'Cancelled'
);

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL,
  "description" varchar,
  "deleted" bool NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL,
  "sku" varchar NOT NULL,
  "price" decimal(12,2) NOT NULL,
  "stock" decimal(12,3) NOT NULL DEFAULT 0,
  "unit" product_units NOT NULL DEFAULT 'Unit',
  "category_id" uuid NOT NULL,
  "active" bool NOT NULL DEFAULT true,
  "deleted" bool NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_products_sku" UNIQUE ("sku"),
  CONSTRAINT "chk_products_stock_non_negative" CHECK (stock >= 0),
  CONSTRAINT "chk_products_price_non_negative" CHECK (price >= 0)
);

CREATE TABLE "sales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "total" decimal(12,2) NOT NULL,
  "user_id" uuid NOT NULL,
  "current_state" sale_states NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_sales_total_non_negative" CHECK (total >= 0)
);

CREATE TABLE "stock_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type_movement" type_movements NOT NULL,
  "quantity" decimal(12,3) NOT NULL,
  "user_id" uuid NOT NULL,
  "sale_id" uuid,
  "product_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_stock_movements_quantity_sign" CHECK (type_movement = 'Adjustment' OR quantity > 0)
);

CREATE TABLE "sale_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL,
  "sale_id" uuid NOT NULL,
  "quantity" decimal(12,3) NOT NULL,
  "unit_price" decimal(12,2) NOT NULL,
  CONSTRAINT "chk_sale_items_quantity_positive" CHECK (quantity > 0),
  CONSTRAINT "chk_sale_items_price_non_negative" CHECK (unit_price >= 0)
);

CREATE TABLE "sale_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sale_state" sale_states NOT NULL,
  "user_id" uuid,
  "sale_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX "idx_products_category_id" ON "products" ("category_id");
CREATE INDEX "idx_stock_movements_product_id_created_at" ON "stock_movements" ("product_id", "created_at");
CREATE INDEX "idx_stock_movements_sale_id" ON "stock_movements" ("sale_id");
CREATE INDEX "idx_sales_created_at" ON "sales" ("created_at");
CREATE INDEX "idx_sales_current_state_created_at" ON "sales" ("current_state", "created_at");
CREATE INDEX "idx_sales_user_id" ON "sales" ("user_id");
CREATE UNIQUE INDEX "uq_sale_items_sale_id_product_id" ON "sale_items" ("sale_id", "product_id");
CREATE INDEX "idx_sale_items_product_id" ON "sale_items" ("product_id");
CREATE INDEX "idx_sale_history_sale_id_created_at" ON "sale_history" ("sale_id", "created_at");

-- Foreign keys (only within this service's database)
ALTER TABLE "products"
  ADD CONSTRAINT "fk_products_category_id"
  FOREIGN KEY ("category_id") REFERENCES "categories" ("id");

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "fk_stock_movements_sale_id"
  FOREIGN KEY ("sale_id") REFERENCES "sales" ("id");

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "fk_stock_movements_product_id"
  FOREIGN KEY ("product_id") REFERENCES "products" ("id");

ALTER TABLE "sale_items"
  ADD CONSTRAINT "fk_sale_items_product_id"
  FOREIGN KEY ("product_id") REFERENCES "products" ("id");

ALTER TABLE "sale_items"
  ADD CONSTRAINT "fk_sale_items_sale_id"
  FOREIGN KEY ("sale_id") REFERENCES "sales" ("id");

ALTER TABLE "sale_history"
  ADD CONSTRAINT "fk_sale_history_sale_id"
  FOREIGN KEY ("sale_id") REFERENCES "sales" ("id");
