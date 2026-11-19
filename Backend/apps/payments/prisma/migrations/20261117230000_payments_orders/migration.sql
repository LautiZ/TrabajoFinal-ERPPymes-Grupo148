-- Checkout Pro moves from the Preferences API to the Orders API (TES-27):
-- rename the columns instead of dropping them so existing rows keep their data

-- RenameColumn
ALTER TABLE "payments" RENAME COLUMN "preference_id" TO "mp_order_id";
ALTER TABLE "payments" RENAME COLUMN "init_point" TO "checkout_url";

-- RenameIndex
ALTER INDEX "uq_payments_preference_id" RENAME TO "uq_payments_mp_order_id";

-- Manual CHECK constraint (Prisma cannot express it in the schema)

-- An order and its checkout URL are created together by Mercado Pago: both or neither
ALTER TABLE "payments" DROP CONSTRAINT "chk_payments_preference_init_point";
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_order_checkout_url" CHECK ((mp_order_id IS NULL) = (checkout_url IS NULL));

-- CreateIndex
-- At most one Pending payment per sale: two concurrent checkouts cannot both reserve one
CREATE UNIQUE INDEX "uq_payments_sale_id_pending" ON "payments"("sale_id") WHERE (payment_state = 'Pending');
