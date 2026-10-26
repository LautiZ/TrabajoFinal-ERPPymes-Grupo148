-- CreateEnum
CREATE TYPE "roles" AS ENUM ('Owner', 'Admin', 'Employee');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR NOT NULL,
    "password_hash" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "surname" VARCHAR,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "role" "roles" NOT NULL DEFAULT 'Employee',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_single_owner" ON "users"("role") WHERE (role = 'Owner');
