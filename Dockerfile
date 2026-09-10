# Homyz — Next.js production image only.
# Does NOT include PostgreSQL, Redis, S3, email, or other third-party services.
# Secrets come from runtime env (`--env-file` / Compose), never from this file.
#
#   docker build --build-arg APP_URL=https://your.domain -t homyz:local .
#   docker run --rm --env-file .env -p 3000:3000 homyz:local

FROM node:22-bookworm-slim AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--dns-result-order=ipv4first \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_LOGLEVEL=http \
    NPM_CONFIG_PROGRESS=true

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
COPY .npmrc ./

# Lockfile install only. Skip postinstall (prisma generate) until the builder stage.
# IPv4-first + http logs: Docker bridge often stalls on IPv6 to registry.npmjs.org.
RUN echo "npm ci: downloading packages (several minutes on first build)" \
  && npm ci --ignore-scripts --no-audit --no-fund

FROM deps AS builder
WORKDIR /app

COPY . .

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG APP_URL
ARG NEXTAUTH_URL
ARG SERVER_ACTION_ALLOWED_ORIGINS
# Placeholders exist only in this builder stage. The runtime image is a
# separate FROM and does not inherit them — pass real secrets at `docker run`.
# Do not prefix a single command (`VAR=value cmd1 && cmd2`); that only
# applies the vars to cmd1, and `next build` then fails collecting API routes.
ENV NODE_ENV=production \
    APP_URL=${APP_URL} \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
    SERVER_ACTION_ALLOWED_ORIGINS=${SERVER_ACTION_ALLOWED_ORIGINS} \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/homyz \
    NEXTAUTH_SECRET=docker-build-placeholder-secret \
    JWT_ACCESS_SECRET=docker-build-placeholder-secret \
    JWT_REFRESH_SECRET=docker-build-placeholder-secret

RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates util-linux \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 999 nodejs \
  && useradd --system --uid 999 --gid nodejs nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated
COPY --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh

RUN mkdir -p \
      public/uploads/listing-photos \
      public/uploads/stamp-icons \
      public/uploads/guidebook-photos \
      public/uploads/host-documents \
    && chown -R nextjs:nodejs public/uploads

# Stay root in the image metadata so the entrypoint can chown a mounted volume,
# then it drops to uid 999 before starting Node.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
