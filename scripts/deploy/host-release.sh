#!/usr/bin/env bash
# Host Node deploy (no sudo, no Docker). Run on the ECS as developer1.
#
#   SKIP_GIT=1  — code already synced by CI (rsync); do not git pull
#   RUN_DB_MIGRATE=true — prisma migrate deploy (uses ~/homyz/.env)
#   APP_DIR     — default $HOME/homyz
set -euo pipefail

# Non-interactive SSH has no TTY. pnpm otherwise aborts removing node_modules.
export CI=true
export PNPM_CONFIRM_MODULES_PURGE=false

APP_DIR="${APP_DIR:-${HOME}/homyz}"
export PNPM_HOME="${PNPM_HOME:-${HOME}/.local/share/pnpm}"
export PATH="${PNPM_HOME}:${HOME}/.local/bin:${HOME}/.local/share/pnpm:/usr/bin:${PATH}"
# Non-interactive SSH does not load .bashrc (where the pnpm installer adds PATH).
if [[ -s "${HOME}/.bashrc" ]]; then
  set +u
  # shellcheck disable=SC1091
  . "${HOME}/.bashrc" || true
  set -u
fi

echo "$(date -Is) host-release start"
echo "APP_DIR=${APP_DIR} HOME=${HOME}"
echo "node=$(command -v node || true) $(node -v 2>/dev/null || true)"
echo "pnpm=$(command -v pnpm || true)"

if [[ ! -f "${APP_DIR}/package.json" && -f "${APP_DIR}/homyz/package.json" ]]; then
  echo "Using nested ${APP_DIR}/homyz (scp layout)"
  APP_DIR="${APP_DIR}/homyz"
fi

cd "${APP_DIR}"
ls -l package.json pnpm-lock.yaml .env 2>/dev/null || ls -l

if [[ ! -f .env ]]; then
  echo "Missing ${APP_DIR}/.env — create it on the server; CI never overwrites it." >&2
  exit 1
fi

if [[ ! -f package.json ]]; then
  echo "Missing ${APP_DIR}/package.json — clone or rsync the repo first." >&2
  exit 1
fi

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi
  mkdir -p "${HOME}/.local/bin"
  export PATH="${HOME}/.local/bin:${PATH}"
  if command -v corepack >/dev/null 2>&1; then
    echo "Enabling pnpm via corepack in ${HOME}/.local/bin (no sudo)"
    corepack enable --install-directory "${HOME}/.local/bin"
    corepack prepare pnpm@10 --activate || true
  fi
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi
  echo "pnpm still missing; using npx pnpm@10"
}

pnpm_run() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  else
    npx --yes pnpm@10 "$@"
  fi
}

ensure_pnpm
echo "pnpm=$(command -v pnpm || echo 'npx pnpm@10')"

if [[ "${SKIP_GIT:-}" != "1" && -d .git ]]; then
  git fetch origin
  git reset --hard origin/main
fi

echo "Installing dependencies"
if [[ -f pnpm-lock.yaml ]]; then
  pnpm_run install --frozen-lockfile
else
  pnpm_run install
fi

if [[ "${RUN_DB_MIGRATE:-}" == "true" ]]; then
  echo "Applying Prisma migrations"
  pnpm_run db:migrate:deploy
fi

echo "Building"
pnpm_run run build

if [[ ! -f .next/standalone/server.js ]]; then
  echo "Build did not produce .next/standalone/server.js" >&2
  exit 1
fi

stop_old() {
  if [[ -f homyz.pid ]]; then
    old="$(tr -d '[:space:]' < homyz.pid || true)"
    if [[ -n "${old}" ]] && kill -0 "${old}" 2>/dev/null; then
      kill "${old}" 2>/dev/null || true
      sleep 2
      kill -9 "${old}" 2>/dev/null || true
    fi
    rm -f homyz.pid
  fi
  pkill -f "${APP_DIR}/.next/standalone/server.js" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
}

echo "Restarting"
stop_old
sleep 1

nohup env HOMYZ_BIND_HOST=0.0.0.0 PORT="${PORT:-3000}" \
  bash "${APP_DIR}/scripts/start-prod.sh" >>"${APP_DIR}/app.log" 2>&1 &
echo $! > homyz.pid

healthy=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "${healthy}" -ne 1 ]]; then
  echo "Health check failed after restart" >&2
  tail -n 80 "${APP_DIR}/app.log" >&2 || true
  exit 1
fi

echo "Release complete ($(node -v))"
curl -fsS http://127.0.0.1:3000/api/health
echo
