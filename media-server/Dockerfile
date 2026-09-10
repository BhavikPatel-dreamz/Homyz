# Homyz media service — owns the uploads volume. Next.js calls this over HTTP.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends util-linux \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 999 media \
  && useradd --system --uid 999 --gid media media

COPY package.json server.mjs storage.mjs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh \
  && mkdir -p /data/uploads \
  && chown -R media:media /data/uploads

ENV NODE_ENV=production \
    PORT=4001 \
    HOSTNAME=0.0.0.0 \
    MEDIA_DATA_DIR=/data/uploads

EXPOSE 4001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4001)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
