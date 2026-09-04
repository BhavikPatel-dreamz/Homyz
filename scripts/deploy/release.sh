#!/usr/bin/env bash
# Blue/green-ish release on a single EC2 host.
# Does not stop the running container until the new image answers /api/health.
#
# Required env:
#   HOMYZ_IMAGE   immutable image, e.g. 123.dkr.ecr.region.amazonaws.com/homyz:abc1234
#   APP_DIR       directory containing docker-compose.prod.yml and .env  (default: /opt/homyz)
#
# Optional:
#   HEALTH_URL    default http://127.0.0.1:3001/api/health
#   COMPOSE_FILE  default docker-compose.prod.yml

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/homyz}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
NEW_NAME="homyz-app-next"
OLD_NAME="homyz-app"

if [[ -z "${HOMYZ_IMAGE:-}" ]]; then
  echo "HOMYZ_IMAGE is required (immutable tag, not only :latest)" >&2
  exit 1
fi

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "Missing ${APP_DIR}/.env — refusing to start a container without runtime secrets." >&2
  exit 1
fi

echo "Pulling ${HOMYZ_IMAGE}"
if [[ -n "${AWS_REGION:-}" && "${HOMYZ_IMAGE}" == *".dkr.ecr."* ]]; then
  ECR_HOST="${HOMYZ_IMAGE%%/*}"
  aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${ECR_HOST}"
fi
docker pull "${HOMYZ_IMAGE}"

echo "${HOMYZ_IMAGE}" > "${APP_DIR}/.image-target"

# Keep the current listener on :3000. Start the candidate on :3001.
if docker ps -a --format '{{.Names}}' | grep -qx "${NEW_NAME}"; then
  docker rm -f "${NEW_NAME}" >/dev/null 2>&1 || true
fi

echo "Starting candidate ${NEW_NAME} on 127.0.0.1:3001"
docker run -d \
  --name "${NEW_NAME}" \
  --env-file "${APP_DIR}/.env" \
  -e NODE_ENV=production \
  -e HOSTNAME=0.0.0.0 \
  -e PORT=3000 \
  --restart unless-stopped \
  --stop-timeout 30 \
  -p 127.0.0.1:3001:3000 \
  "${HOMYZ_IMAGE}" >/dev/null

healthy=0
for i in $(seq 1 30); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "${healthy}" -ne 1 ]]; then
  echo "Candidate unhealthy — leaving ${OLD_NAME} in place and removing ${NEW_NAME}" >&2
  docker logs --tail 80 "${NEW_NAME}" >&2 || true
  docker rm -f "${NEW_NAME}" >/dev/null 2>&1 || true
  exit 1
fi

echo "Candidate healthy. Switching published port 3000."

if docker ps -a --format '{{.Names}}' | grep -qx "${OLD_NAME}"; then
  docker inspect -f '{{.Config.Image}}' "${OLD_NAME}" > "${APP_DIR}/.image-previous" || true
  docker stop -t 30 "${OLD_NAME}" >/dev/null || true
  docker rm "${OLD_NAME}" >/dev/null || true
fi

docker stop -t 5 "${NEW_NAME}" >/dev/null
docker rm "${NEW_NAME}" >/dev/null

# Bind 0.0.0.0:3000 so the ALB target group can reach the instance (SG still restricts source).
docker run -d \
  --name "${OLD_NAME}" \
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

live_ok=0
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    live_ok=1
    break
  fi
  sleep 2
done

if [[ "${live_ok}" -ne 1 ]]; then
  echo "Live container failed health after switch. Attempting rollback." >&2
  docker logs --tail 80 "${OLD_NAME}" >&2 || true
  if [[ -f "${APP_DIR}/.image-previous" ]]; then
    PREV="$(tr -d '[:space:]' < "${APP_DIR}/.image-previous")"
    if [[ -n "${PREV}" ]]; then
      HOMYZ_IMAGE="${PREV}" APP_DIR="${APP_DIR}" bash "$(dirname "$0")/rollback.sh"
    fi
  fi
  exit 1
fi

echo "${HOMYZ_IMAGE}" > "${APP_DIR}/.image-current"
echo "Release complete: ${HOMYZ_IMAGE}"
