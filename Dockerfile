# Homyz production image (Next.js 16 standalone).
# Secrets are injected at runtime — never COPY .env into the image.
#
#   docker build -t homyz:<git-sha> .
#   docker run --env-file .env -p 3000:3000 homyz:<git-sha>

FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./

# postinstall runs `prisma generate`; schema + prisma config must already be present.
RUN npm ci

FROM deps AS builder
WORKDIR /app

COPY . .

# Dummy values so `next build` / Prisma generate can run. Real secrets are runtime-only.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/homyz \
    NEXTAUTH_SECRET=docker-build-placeholder-secret \
    JWT_ACCESS_SECRET=docker-build-placeholder-secret \
    JWT_REFRESH_SECRET=docker-build-placeholder-secret

# Public hostname baked into Server Action origin allow-list (not a secret).
ARG APP_URL
ARG NEXTAUTH_URL
ARG SERVER_ACTION_ALLOWED_ORIGINS
ENV APP_URL=${APP_URL} \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
    SERVER_ACTION_ALLOWED_ORIGINS=${SERVER_ACTION_ALLOWED_ORIGINS}

RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated

RUN mkdir -p public/uploads \
  && chown -R nextjs:nodejs public/uploads

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Next.js standalone server handles SIGTERM/SIGINT (finish in-flight work).
CMD ["node", "server.js"]
