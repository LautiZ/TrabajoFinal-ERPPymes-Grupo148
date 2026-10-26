-- CreateEnum
CREATE TYPE "product_units" AS ENUM ('Unit', 'Kg', 'Meter', 'Liter');

-- CreateEnum
CREATE TYPE "type_movements" AS ENUM ('Income', 'Outcome', 'Adjustment');

-- CreateEnum
CREATE TYPE "sale_states" AS ENUM ('Ordered', 'Paid', 'Dispatched', 'Cancelled');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR NOT NULL,
    "description" VARCHAR,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR NOT NULL,
    "sku" VARCHAR NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit" "product_units" NOT NULL DEFAULT 'Unit',
    "category_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_number" SERIAL NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "user_id" UUID NOT NULL,
    "current_state" "sale_states" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type_movement" "type_movements" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "user_id" UUID NOT NULL,
    "sale_id" UUID,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_state" "sale_states" NOT NULL,
    "user_id" UUID,
    "sale_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_categories_name_active" ON "categories"("name") WHERE (deleted = false);

-- CreateIndex
CREATE UNIQUE INDEX "uq_products_sku" ON "products"("sku");

-- CreateIndex
CREATE INDEX "idx_products_category_id" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sales_sale_number" ON "sales"("sale_number");

-- CreateIndex
CREATE INDEX "idx_sales_created_at" ON "sales"("created_at");

-- CreateIndex
CREATE INDEX "idx_sales_current_state_created_at" ON "sales"("current_state", "created_at");

-- CreateIndex
CREATE INDEX "idx_sales_user_id" ON "sales"("user_id");

-- CreateIndex
CREATE INDEX "idx_stock_movements_product_id_created_at" ON "stock_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_stock_movements_sale_id" ON "stock_movements"("sale_id");

-- CreateIndex
CREATE INDEX "idx_sale_items_product_id" ON "sale_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_items_sale_id_product_id" ON "sale_items"("sale_id", "product_id");

-- CreateIndex
CREATE INDEX "idx_sale_history_sale_id_created_at" ON "sale_history"("sale_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_history_sale_id_sale_state" ON "sale_history"("sale_id", "sale_state");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "fk_products_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "fk_stock_movements_sale_id" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "fk_stock_movements_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "fk_sale_items_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "fk_sale_items_sale_id" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_history" ADD CONSTRAINT "fk_sale_history_sale_id" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual: CHECK constraints (not expressible in schema.prisma)
ALTER TABLE "products" ADD CONSTRAINT "chk_products_stock_non_negative" CHECK (stock >= 0);
ALTER TABLE "products" ADD CONSTRAINT "chk_products_price_non_negative" CHECK (price >= 0);
ALTER TABLE "sales" ADD CONSTRAINT "chk_sales_total_non_negative" CHECK (total >= 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "chk_stock_movements_quantity_sign" CHECK (type_movement = 'Adjustment' OR quantity > 0);
ALTER TABLE "sale_items" ADD CONSTRAINT "chk_sale_items_quantity_positive" CHECK (quantity > 0);
ALTER TABLE "sale_items" ADD CONSTRAINT "chk_sale_items_price_non_negative" CHECK (unit_price >= 0);
