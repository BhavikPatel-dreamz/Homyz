#!/bin/sh
# chown the uploads volume, then drop to uid 999 before starting Node.
set -eu

DATA_DIR="${MEDIA_DATA_DIR:-/data/uploads}"

mkdir -p \
  "$DATA_DIR/listing-photos" \
  "$DATA_DIR/stamp-icons" \
  "$DATA_DIR/guidebook-photos" \
  "$DATA_DIR/host-documents"

chown -R 999:999 "$DATA_DIR"

exec setpriv --reuid=999 --regid=999 --clear-groups --inh-caps=-all \
  node server.mjs
