# ---------- base: node + pnpm ----------
FROM node:24.11.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ---------- deps: all dependencies (dev included, needed to build) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml .pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile

# ---------- build: compile only the requested app ----------
FROM deps AS build
ARG APP
COPY . .
# generated Prisma clients are not versioned; the gateway has no schema
RUN if [ -f "apps/${APP}/prisma.config.ts" ]; then pnpm prisma:generate:${APP}; fi
RUN pnpm exec nest build ${APP}

# ---------- prod-deps: runtime dependencies only ----------
FROM base AS prod-deps
# set per service in docker-compose.yml; services without a database skip Prisma
ARG USES_PRISMA=true
COPY package.json pnpm-lock.yaml .pnpmfile.cjs ./
RUN if [ "$USES_PRISMA" != "true" ]; then pnpm remove @prisma/client @prisma/adapter-pg --lockfile-only; fi \
 && pnpm install --frozen-lockfile --prod

# ---------- migrate: one-shot job that applies every service's migrations ----------
# Based on deps because it needs the Prisma CLI, which runtime images never include.
# It must stay before runtime: services build without a target, so the last stage is the default.
FROM deps AS migrate
COPY apps/auth/prisma.config.ts apps/auth/prisma.config.ts
COPY apps/auth/prisma apps/auth/prisma
COPY apps/erp/prisma.config.ts apps/erp/prisma.config.ts
COPY apps/erp/prisma apps/erp/prisma
COPY apps/payments/prisma.config.ts apps/payments/prisma.config.ts
COPY apps/payments/prisma apps/payments/prisma
# Runs as root on purpose: the Prisma CLI refuses to start unless it can write to
# its engines folder, which root installed in deps. Chowning node_modules would
# duplicate it in a new layer. It is a short-lived job with no exposed ports;
# the long-running runtime images still run as node.
# The three configs read DATABASE_URL, so each command gets its own value.
# ${VAR:?} aborts the job when a URL is missing instead of migrating the wrong schema.
CMD DATABASE_URL="${AUTH_DATABASE_URL:?}" node_modules/.bin/prisma migrate deploy --config apps/auth/prisma.config.ts \
 && DATABASE_URL="${ERP_DATABASE_URL:?}" node_modules/.bin/prisma migrate deploy --config apps/erp/prisma.config.ts \
 && DATABASE_URL="${PAYMENTS_DATABASE_URL:?}" node_modules/.bin/prisma migrate deploy --config apps/payments/prisma.config.ts

# ---------- runtime: final image ----------
FROM node:24.11.1-alpine AS runtime
ARG APP
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist/apps/${APP} ./dist
USER node
CMD ["node", "dist/main.js"]
