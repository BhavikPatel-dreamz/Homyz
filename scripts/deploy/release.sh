#!/usr/bin/env bash
# Pull immutable app + media images and recreate containers.
# Named volume homyz_uploads is NEVER removed (no `compose down -v`).
#
# Required:
#   HOMYZ_IMAGE         Next.js image
#   HOMYZ_MEDIA_IMAGE   media service image
#   APP_DIR             directory with .env and docker-compose.prod.yml
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/homyz}"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"

if [[ -z "${HOMYZ_IMAGE:-}" ]]; then
  echo "HOMYZ_IMAGE is required (use a git-sha tag, not only :latest)" >&2
  exit 1
fi

if [[ -z "${HOMYZ_MEDIA_IMAGE:-}" ]]; then
  echo "HOMYZ_MEDIA_IMAGE is required" >&2
  exit 1
fi

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "Missing ${APP_DIR}/.env — runtime secrets must live on the host, not in the image." >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ -n "${AWS_REGION:-}" && "${HOMYZ_IMAGE}" == *".dkr.ecr."* ]]; then
  ECR_HOST="${HOMYZ_IMAGE%%/*}"
  aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${ECR_HOST}"
fi

if docker inspect homyz-app >/dev/null 2>&1; then
  docker inspect -f '{{.Config.Image}}' homyz-app > "${APP_DIR}/.image-previous" || true
fi
if docker inspect homyz-media >/dev/null 2>&1; then
  docker inspect -f '{{.Config.Image}}' homyz-media > "${APP_DIR}/.image-media-previous" || true
fi

export HOMYZ_IMAGE
export HOMYZ_MEDIA_IMAGE

echo "Pulling ${HOMYZ_IMAGE}"
docker pull "${HOMYZ_IMAGE}"
echo "Pulling ${HOMYZ_MEDIA_IMAGE}"
docker pull "${HOMYZ_MEDIA_IMAGE}"

echo "${HOMYZ_IMAGE}" > "${APP_DIR}/.image-target"
echo "${HOMYZ_MEDIA_IMAGE}" > "${APP_DIR}/.image-media-target"

echo "Recreating app + media (volume homyz_uploads is kept)"
# Never add --volumes / -v. That would wipe uploaded files.
docker compose -f "${COMPOSE_FILE}" up -d --no-build --remove-orphans

live_ok=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1 \
    && curl -fsS http://127.0.0.1:4001/health >/dev/null 2>&1; then
    live_ok=1
    break
  fi
  sleep 2
done

if [[ "${live_ok}" -ne 1 ]]; then
  echo "Health check failed (app :3000 and/or media :4001)." >&2
  docker compose -f "${COMPOSE_FILE}" logs --tail 80 >&2 || true
  if [[ -f "${APP_DIR}/.image-previous" && -f "${APP_DIR}/.image-media-previous" ]]; then
    PREV="$(tr -d '[:space:]' < "${APP_DIR}/.image-previous")"
    PREV_MEDIA="$(tr -d '[:space:]' < "${APP_DIR}/.image-media-previous")"
    if [[ -n "${PREV}" && -n "${PREV_MEDIA}" ]]; then
      HOMYZ_IMAGE="${PREV}" HOMYZ_MEDIA_IMAGE="${PREV_MEDIA}" APP_DIR="${APP_DIR}" \
        bash "$(dirname "$0")/rollback.sh"
    fi
  fi
  exit 1
fi

echo "${HOMYZ_IMAGE}" > "${APP_DIR}/.image-current"
echo "${HOMYZ_MEDIA_IMAGE}" > "${APP_DIR}/.image-media-current"
echo "Release complete: app=${HOMYZ_IMAGE} media=${HOMYZ_MEDIA_IMAGE}"
