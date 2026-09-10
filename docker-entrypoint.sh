#!/bin/sh
# Runtime as root only long enough to make upload dirs writable for uid 999,
# then drop privileges. A named volume for /app/public/uploads is root-owned
# on first create and would otherwise 403/EACCES on media writes.
set -eu

mkdir -p \
  /app/public/uploads/listing-photos \
  /app/public/uploads/stamp-icons \
  /app/public/uploads/host-documents

chown -R 999:999 /app/public/uploads

exec setpriv --reuid=999 --regid=999 --clear-groups --inh-caps=-all \
  node server.js
