# ---------- base: node + pnpm ----------
FROM node:24.11.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ---------- deps: all dependencies (dev included, needed to build) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
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
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---------- runtime: final image ----------
FROM node:24.11.1-alpine AS runtime
ARG APP
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist/apps/${APP} ./dist
USER node
CMD ["node", "dist/main.js"]