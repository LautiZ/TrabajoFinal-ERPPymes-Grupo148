-- =============================================================
-- Payments service database (DDL)
-- Engine: PostgreSQL 13+ (gen_random_uuid() is built in)
-- Owned exclusively by the Payments microservice (database-per-service).
--
-- Cross-service references (no FK, the data lives in another database):
--   payments.sale_id -> erp.sales.id
--
-- Note: updated_at defaults only apply on INSERT. It is refreshed on every
-- UPDATE by the application layer (Prisma @updatedAt).
-- =============================================================

CREATE TYPE "payment_states" AS ENUM (
  'Pending',
  'Paid',
  'Rejected',
  'Refunded' -- the sale was cancelled after being paid (RN-11.1)
);

CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_state" payment_states NOT NULL DEFAULT 'Pending',
  "mp_payment_id" varchar,
  -- Mercado Pago checkout preference: one per payment attempt
  "preference_id" varchar,
  -- Checkout URL, stored so a pending payment can be resumed without calling Mercado Pago again
  "init_point" varchar,
  "amount" decimal(12,2) NOT NULL,
  "sale_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_payments_mp_payment_id" UNIQUE ("mp_payment_id"),
  CONSTRAINT "uq_payments_preference_id" UNIQUE ("preference_id"),
  CONSTRAINT "chk_payments_amount_positive" CHECK (amount > 0),
  -- A preference and its checkout URL are created together: both or neither
  CONSTRAINT "chk_payments_preference_init_point" CHECK ((preference_id IS NULL) = (init_point IS NULL))
);

-- Natural key; also serves lookups by sale_id
CREATE UNIQUE INDEX "uq_payments_sale_id_created_at" ON "payments" ("sale_id", "created_at");
