#!/usr/bin/env bash
# Start/restart the media process. Never deletes the upload directory.
#
# Uses APP_DIR, and .env keys: MEDIA_SERVER_SECRET, MEDIA_PUBLIC_BASE_URL, MEDIA_DATA_DIR.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "${APP_DIR}"

if [[ ! -f media-server/server.mjs ]]; then
  echo "media-server/server.mjs missing — skip media restart" >&2
  exit 0
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

MEDIA_DATA_DIR="${MEDIA_DATA_DIR:-${APP_DIR}/public/uploads}"

mkdir -p \
  "${MEDIA_DATA_DIR}/listing-photos" \
  "${MEDIA_DATA_DIR}/stamp-icons" \
  "${MEDIA_DATA_DIR}/guidebook-photos" \
  "${MEDIA_DATA_DIR}/host-documents"

if [[ -z "${MEDIA_SERVER_SECRET:-}" ]]; then
  echo "MEDIA_SERVER_SECRET is not set — media server not started" >&2
  exit 0
fi

stop_media() {
  if [[ -f media.pid ]]; then
    old="$(tr -d '[:space:]' < media.pid || true)"
    if [[ -n "${old}" ]] && kill -0 "${old}" 2>/dev/null; then
      kill "${old}" 2>/dev/null || true
      sleep 1
      kill -9 "${old}" 2>/dev/null || true
    fi
    rm -f media.pid
  fi
  pkill -f "${APP_DIR}/media-server/server.mjs" 2>/dev/null || true
}

stop_media
sleep 1

nohup env \
  NODE_ENV=production \
  HOSTNAME=0.0.0.0 \
  PORT="${MEDIA_PORT:-4001}" \
  MEDIA_DATA_DIR="${MEDIA_DATA_DIR}" \
  MEDIA_SERVER_SECRET="${MEDIA_SERVER_SECRET}" \
  MEDIA_PUBLIC_BASE_URL="${MEDIA_PUBLIC_BASE_URL:-}" \
  node "${APP_DIR}/media-server/server.mjs" >>"${APP_DIR}/media.log" 2>&1 &
echo $! > media.pid

ok=0
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${MEDIA_PORT:-4001}/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "${ok}" -ne 1 ]]; then
  echo "Media health check failed" >&2
  tail -n 40 "${APP_DIR}/media.log" >&2 || true
  exit 1
fi

echo "Media server running (pid $(tr -d '[:space:]' < media.pid)) data=${MEDIA_DATA_DIR}"
