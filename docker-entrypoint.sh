#!/bin/sh
# Fallback only: production Compose stores files on the media service volume.
set -eu

mkdir -p \
  /app/upload/listing-photos \
  /app/upload/stamp-icons \
  /app/upload/guidebook-photos \
  /app/upload/host-documents

chown -R 999:999 /app/upload
mkdir -p /app/public
ln -sfn /app/upload /app/public/uploads

exec setpriv --reuid=999 --regid=999 --clear-groups --inh-caps=-all \
  node server.js
