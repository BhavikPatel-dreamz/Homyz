#!/usr/bin/env bash
# Restore the previous immutable image recorded in APP_DIR/.image-previous
# (written by scripts/deploy/release.sh before switching traffic).

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/homyz}"
NAME="homyz-app"

if [[ -z "${HOMYZ_IMAGE:-}" ]]; then
  if [[ ! -f "${APP_DIR}/.image-previous" ]]; then
    echo "No HOMYZ_IMAGE and no ${APP_DIR}/.image-previous — cannot roll back." >&2
    exit 1
  fi
  HOMYZ_IMAGE="$(tr -d '[:space:]' < "${APP_DIR}/.image-previous")"
fi

if [[ -z "${HOMYZ_IMAGE}" ]]; then
  echo "Previous image tag is empty." >&2
  exit 1
fi

if [[ ! -f "${APP_DIR}/.env" ]]; then
  echo "Missing ${APP_DIR}/.env" >&2
  exit 1
fi

echo "Rolling back to ${HOMYZ_IMAGE}"
docker pull "${HOMYZ_IMAGE}"

docker rm -f "${NAME}" >/dev/null 2>&1 || true
docker rm -f homyz-app-next >/dev/null 2>&1 || true

docker run -d \
  --name "${NAME}" \
  --env-file "${APP_DIR}/.env" \
  -e NODE_ENV=production \
  -e HOSTNAME=0.0.0.0 \
  -e PORT=3000 \
  --restart unless-stopped \
  --stop-timeout 30 \
  -p 3000:3000 \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  "${HOMYZ_IMAGE}" >/dev/null

ok=0
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "${ok}" -ne 1 ]]; then
  echo "Rollback image failed /api/health" >&2
  docker logs --tail 80 "${NAME}" >&2 || true
  exit 1
fi

echo "${HOMYZ_IMAGE}" > "${APP_DIR}/.image-current"
echo "Rollback complete: ${HOMYZ_IMAGE}"
