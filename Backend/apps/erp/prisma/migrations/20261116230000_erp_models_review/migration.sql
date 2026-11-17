-- AlterTable
ALTER TABLE "products" ADD COLUMN     "low_stock_threshold" DECIMAL(12,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "receipt_number" INTEGER;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "reason" VARCHAR;

-- CreateIndex
CREATE UNIQUE INDEX "uq_sales_receipt_number" ON "sales"("receipt_number");

-- Manual CHECK constraints (Prisma cannot express them in the schema)

-- A product with price 0 is a data entry error, not a valid case
ALTER TABLE "products" DROP CONSTRAINT "chk_products_price_non_negative";
ALTER TABLE "products" ADD CONSTRAINT "chk_products_price_positive" CHECK (price > 0);

ALTER TABLE "products" ADD CONSTRAINT "chk_products_low_stock_threshold_non_negative" CHECK (low_stock_threshold >= 0);

ALTER TABLE "sales" ADD CONSTRAINT "chk_sales_receipt_number_positive" CHECK (receipt_number > 0);

-- Manual adjustments must say why; system movements (sales, returns) carry no reason
ALTER TABLE "stock_movements" ADD CONSTRAINT "chk_stock_movements_adjustment_reason" CHECK (type_movement <> 'Adjustment' OR reason IS NOT NULL);
