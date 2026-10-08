#!/usr/bin/env bash
# Invoked by deploy/homyz-guest-favorite-evaluation.timer.
# The secret comes from the host's .env via the systemd EnvironmentFile.
set -euo pipefail

if [[ -z "${GUEST_FAVORITE_EVALUATION_CRON_SECRET:-}" ]]; then
  echo "GUEST_FAVORITE_EVALUATION_CRON_SECRET is required" >&2
  exit 2
fi

APP_URL="${HOMYZ_APP_INTERNAL_URL:-http://127.0.0.1:3000}"
ENDPOINT="${APP_URL%/}/api/internal/guest-favorite/evaluations"

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --retry 2 \
  --retry-all-errors \
  --retry-delay 15 \
  --connect-timeout 10 \
  --max-time 1800 \
  -X POST \
  -H "Authorization: Bearer ${GUEST_FAVORITE_EVALUATION_CRON_SECRET}" \
  -H "Content-Type: application/json" \
  "${ENDPOINT}"
echo
