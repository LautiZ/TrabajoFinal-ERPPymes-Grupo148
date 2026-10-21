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
  'Rejected'
);

CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_state" payment_states NOT NULL DEFAULT 'Pending',
  "mp_payment_id" varchar,
  "amount" decimal(12,2) NOT NULL,
  "sale_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_payments_mp_payment_id" UNIQUE ("mp_payment_id"),
  CONSTRAINT "chk_payments_amount_positive" CHECK (amount > 0)
);

CREATE INDEX "idx_payments_sale_id" ON "payments" ("sale_id");
