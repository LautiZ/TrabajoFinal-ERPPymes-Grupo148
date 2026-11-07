-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sessions_user_id_expires_at" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "idx_sessions_expires_at" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual: CHECK constraints (not expressible in schema.prisma)
ALTER TABLE "sessions" ADD CONSTRAINT "chk_sessions_expires_after_created" CHECK (expires_at > created_at);
ALTER TABLE "sessions" ADD CONSTRAINT "chk_sessions_revoked_after_created" CHECK (revoked_at IS NULL OR revoked_at >= created_at);