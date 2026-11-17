# ---------- build: node + pnpm compile the Angular app ----------
# Angular 22's CLI requires Node >= 24.15 (the backend image can stay on 24.11)
FROM node:24.15.0-alpine AS build
# Same pnpm version as "packageManager" in package.json
RUN corepack enable && corepack prepare pnpm@10.5.0 --activate
WORKDIR /app
# Dependencies first: this layer is reused while the lockfile does not change
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---------- runtime: nginx serves the static files and proxies /api ----------
FROM nginx:1.29.3-alpine AS runtime
# Gateway address inside the Docker network; override it per environment at run time
ENV GATEWAY_URL=http://gateway:3000
# Only this variable is substituted in the template, so nginx's own $uri, $host... stay intact
ENV NGINX_ENVSUBST_FILTER=^GATEWAY_URL$
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
# The image renders templates/*.template into conf.d/ on start (replaces the default site)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
