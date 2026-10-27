#!/usr/bin/env bash
# Start the local media service before Next.js so uploads never target a stale
# remote endpoint or fall back to the application filesystem.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

MEDIA_PID=""
if ! curl --fail --silent --show-error http://127.0.0.1:4001/health >/dev/null 2>&1; then
  node --env-file=.env --env-file-if-exists=.env.local \
    media-server/server.mjs &
  MEDIA_PID=$!
fi

cleanup() {
  if [[ -n "$MEDIA_PID" ]] && kill -0 "$MEDIA_PID" 2>/dev/null; then
    kill "$MEDIA_PID" 2>/dev/null || true
    wait "$MEDIA_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 20); do
  if curl --fail --silent --show-error http://127.0.0.1:4001/health >/dev/null 2>&1; then
    ./node_modules/.bin/next dev "$@"
    exit $?
  fi
  sleep 1
done

echo "The local media server did not become healthy on http://127.0.0.1:4001." >&2
exit 1
