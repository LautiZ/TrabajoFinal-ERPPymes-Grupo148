-- =============================================================
-- Auth service database (DDL)
-- Engine: PostgreSQL 13+ (gen_random_uuid() is built in)
-- Owned exclusively by the Auth microservice (database-per-service).
-- =============================================================

CREATE TYPE "roles" AS ENUM (
  'Owner',
  'Admin',
  'Employee'
);

-- Note: updated_at defaults only apply on INSERT. It is refreshed on every
-- UPDATE by the application layer (Prisma @updatedAt).
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar NOT NULL,
  "password_hash" varchar NOT NULL,
  "name" varchar NOT NULL,
  "surname" varchar,
  "active" bool NOT NULL DEFAULT true,
  "role" roles NOT NULL DEFAULT 'Employee',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_users_email" UNIQUE ("email")
);

-- Only one Owner may exist (RN-16.1). A plain UNIQUE on role would also
-- block multiple Employees, so a partial unique index is used instead.
CREATE UNIQUE INDEX "uq_users_single_owner" ON "users" ("role") WHERE "role" = 'Owner';
