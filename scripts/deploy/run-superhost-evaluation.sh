#!/usr/bin/env bash
# Invoked by deploy/homyz-superhost-evaluation.timer.
# The secret comes from the host's .env via the systemd EnvironmentFile.
set -euo pipefail

if [[ -z "${SUPERHOST_EVALUATION_CRON_SECRET:-}" ]]; then
  echo "SUPERHOST_EVALUATION_CRON_SECRET is required" >&2
  exit 2
fi

APP_URL="${HOMYZ_APP_INTERNAL_URL:-http://127.0.0.1:3000}"
ENDPOINT="${APP_URL%/}/api/internal/superhost/evaluations"

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --retry 2 \
  --retry-all-errors \
  --retry-delay 30 \
  --connect-timeout 10 \
  --max-time 2700 \
  -X POST \
  -H "Authorization: Bearer ${SUPERHOST_EVALUATION_CRON_SECRET}" \
  -H "Content-Type: application/json" \
  "${ENDPOINT}"
echo

