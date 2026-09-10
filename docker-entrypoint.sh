#!/bin/sh
# Fallback only: production Compose stores files on the media service volume.
set -eu

mkdir -p \
  /app/public/uploads/listing-photos \
  /app/public/uploads/stamp-icons \
  /app/public/uploads/guidebook-photos \
  /app/public/uploads/host-documents

chown -R 999:999 /app/public/uploads

exec setpriv --reuid=999 --regid=999 --clear-groups --inh-caps=-all \
  node server.js
