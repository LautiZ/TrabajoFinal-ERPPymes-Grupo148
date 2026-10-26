-- CreateEnum
CREATE TYPE "payment_states" AS ENUM ('Pending', 'Paid', 'Rejected', 'Refunded');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_state" "payment_states" NOT NULL DEFAULT 'Pending',
    "mp_payment_id" VARCHAR,
    "amount" DECIMAL(12,2) NOT NULL,
    "sale_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_payments_mp_payment_id" ON "payments"("mp_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payments_sale_id_created_at" ON "payments"("sale_id", "created_at");

-- Manual: CHECK constraints (not expressible in schema.prisma)
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_amount_positive" CHECK (amount > 0);
