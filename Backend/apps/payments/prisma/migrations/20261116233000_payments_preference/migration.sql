-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "init_point" VARCHAR,
ADD COLUMN     "preference_id" VARCHAR;

-- CreateIndex
CREATE UNIQUE INDEX "uq_payments_preference_id" ON "payments"("preference_id");

-- Manual CHECK constraint (Prisma cannot express it in the schema)

-- A preference and its checkout URL are created together by Mercado Pago: both or neither
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_preference_init_point" CHECK ((preference_id IS NULL) = (init_point IS NULL));
