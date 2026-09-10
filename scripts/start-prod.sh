#!/usr/bin/env bash
# Production start for Next.js `output: "standalone"`.
# `next start` is not supported with standalone — use this instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

if [[ ! -f .next/standalone/server.js ]]; then
  echo "Missing .next/standalone/server.js — run: pnpm run build" >&2
  exit 1
fi

# Copy public assets into standalone without wiping live uploads.
mkdir -p .next/standalone/public
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude 'uploads/' public/ .next/standalone/public/
else
  find public -mindepth 1 -maxdepth 1 ! -name uploads -exec cp -a {} .next/standalone/public/ \;
fi
mkdir -p "${ROOT}/public/uploads"
# Drop a copied uploads tree inside standalone only — never the live store.
rm -rf .next/standalone/public/uploads
ln -sfn "${ROOT}/public/uploads" .next/standalone/public/uploads
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static
if [[ -d generated ]]; then
  cp -a generated .next/standalone/
fi

export HOSTNAME="${HOMYZ_BIND_HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
exec node .next/standalone/server.js
