#!/usr/bin/env bash
# Restore the previous app + media images. Does not delete volume homyz_uploads.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/homyz}"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"

if [[ -z "${HOMYZ_IMAGE:-}" ]]; then
  if [[ ! -f "${APP_DIR}/.image-previous" ]]; then
    echo "No HOMYZ_IMAGE and no ${APP_DIR}/.image-previous" >&2
    exit 1
  fi
  HOMYZ_IMAGE="$(tr -d '[:space:]' < "${APP_DIR}/.image-previous")"
fi

if [[ -z "${HOMYZ_MEDIA_IMAGE:-}" ]]; then
  if [[ -f "${APP_DIR}/.image-media-previous" ]]; then
    HOMYZ_MEDIA_IMAGE="$(tr -d '[:space:]' < "${APP_DIR}/.image-media-previous")"
  fi
fi

if [[ -z "${HOMYZ_IMAGE}" || -z "${HOMYZ_MEDIA_IMAGE:-}" || ! -f "${APP_DIR}/.env" ]]; then
  echo "Need HOMYZ_IMAGE, HOMYZ_MEDIA_IMAGE, and ${APP_DIR}/.env" >&2
  exit 1
fi

cd "${APP_DIR}"

if [[ -n "${AWS_REGION:-}" && "${HOMYZ_IMAGE}" == *".dkr.ecr."* ]]; then
  ECR_HOST="${HOMYZ_IMAGE%%/*}"
  aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${ECR_HOST}"
fi

echo "Rolling back to app=${HOMYZ_IMAGE} media=${HOMYZ_MEDIA_IMAGE}"
docker pull "${HOMYZ_IMAGE}"
docker pull "${HOMYZ_MEDIA_IMAGE}"

export HOMYZ_IMAGE
export HOMYZ_MEDIA_IMAGE
docker compose -f "${COMPOSE_FILE}" up -d --no-build --remove-orphans

ok=0
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1 \
    && curl -fsS http://127.0.0.1:4001/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "${ok}" -ne 1 ]]; then
  echo "Rollback failed /api/health or media /health" >&2
  docker compose -f "${COMPOSE_FILE}" logs --tail 80 >&2 || true
  exit 1
fi

echo "${HOMYZ_IMAGE}" > "${APP_DIR}/.image-current"
echo "${HOMYZ_MEDIA_IMAGE}" > "${APP_DIR}/.image-media-current"
echo "Rollback complete: ${HOMYZ_IMAGE}"
