#!/usr/bin/env bash
#
# smoke.sh — end-to-end smoke test of the homyz mobile-shape JSON API.
#
# Exercises the full token lifecycle exactly as a mobile client would:
#   register -> login -> /users/me (Bearer) -> refresh -> /users/me (rotated) -> logout
# plus security assertions: public signup MUST reject role:"ADMIN", and
# protected endpoints MUST reject requests with no token.
#
# Usage:
#   pnpm dev            # (in another terminal) — server must be running
#   ./scripts/smoke.sh  # or: BASE=http://localhost:3000/api/v1 ./scripts/smoke.sh
#
# Requires: curl, jq.

set -u

BASE="${BASE:-http://localhost:3000/api/v1}"
PASS=0
FAIL=0

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: this script requires 'jq'. Install it and retry." >&2
  exit 1
fi

# Unique email per run so re-runs don't 409 on the register step.
EMAIL="smoke+$(date +%s)@example.com"
PASSWORD="smoketest123"

CODE=""
BODY=""

# call METHOD PATH [JSON_BODY] [BEARER_TOKEN] -> sets $CODE and $BODY
call() {
  local method="$1" path="$2" data="${3:-}" token="${4:-}"
  local args=(-sS -X "$method" "$BASE$path" -H 'Content-Type: application/json')
  [ -n "$data" ] && args+=(-d "$data")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  local resp
  resp="$(curl -w $'\n%{http_code}' "${args[@]}")"
  CODE="${resp##*$'\n'}"
  BODY="${resp%$'\n'*}"
}

# check DESCRIPTION EXPECTED_CODE [JQ_FILTER_THAT_MUST_BE_TRUE]
check() {
  local desc="$1" want="$2" filter="${3:-}"
  local ok=1
  [ "$CODE" = "$want" ] || ok=0
  if [ -n "$filter" ] && ! echo "$BODY" | jq -e "$filter" >/dev/null 2>&1; then
    ok=0
  fi
  if [ "$ok" = 1 ]; then
    echo "  PASS  $desc (HTTP $CODE)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $desc — expected HTTP $want${filter:+ and $filter}, got HTTP $CODE"
    echo "        body: $BODY"
    FAIL=$((FAIL + 1))
  fi
}

echo "→ Base URL: $BASE"
echo "→ Test account: $EMAIL"
echo

echo "1. Register (USER)"
call POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Smoke\"}"
check "register returns 201 + success envelope" 201 '.success == true and .data.role == "USER"'

echo "2. SECURITY: public signup must reject role:\"ADMIN\""
call POST /auth/register "{\"email\":\"admin+$(date +%s)@example.com\",\"password\":\"$PASSWORD\",\"role\":\"ADMIN\"}"
check "register with role=ADMIN is rejected (422)" 422 '.success == false and .error.code == "VALIDATION"'

echo "3. SECURITY: protected endpoint rejects no-token request"
call GET /users/me
check "GET /users/me without token → 401" 401 '.success == false and .error.code == "UNAUTHORIZED"'

echo "4. Login → token pair"
call POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
check "login returns 200 + tokens" 200 '.data.accessToken and .data.refreshToken'
ACCESS="$(echo "$BODY" | jq -r '.data.accessToken // empty')"
REFRESH="$(echo "$BODY" | jq -r '.data.refreshToken // empty')"

echo "5. GET /users/me with Bearer access token"
call GET /users/me "" "$ACCESS"
check "authenticated /users/me returns the account" 200 ".success == true and .data.email == \"$EMAIL\""

echo "6. Refresh → rotated token pair"
call POST /auth/refresh "{\"refreshToken\":\"$REFRESH\"}"
check "refresh returns a new token pair" 200 '.data.accessToken and .data.refreshToken'
NEW_ACCESS="$(echo "$BODY" | jq -r '.data.accessToken // empty')"
NEW_REFRESH="$(echo "$BODY" | jq -r '.data.refreshToken // empty')"

echo "7. Rotated access token still authorizes /users/me"
call GET /users/me "" "$NEW_ACCESS"
check "rotated access token works" 200 '.success == true'

echo "8. SECURITY: old refresh token is revoked after rotation"
call POST /auth/refresh "{\"refreshToken\":\"$REFRESH\"}"
check "reusing the old refresh token → 401" 401 '.success == false'

echo "9. Logout (revoke current refresh token)"
call POST /auth/logout "{\"refreshToken\":\"$NEW_REFRESH\"}"
check "logout succeeds" 200 '.success == true'

echo "10. Forgot-password never enumerates accounts"
call POST /auth/forgot-password "{\"email\":\"does-not-exist@example.com\"}"
check "forgot-password for unknown email still 200" 200 '.success == true'

echo "11. OTP send (code is delivered via SMS/email, or logged in dev)"
call POST /auth/otp/send "{\"identifier\":\"+15551234567\",\"channel\":\"SMS\",\"purpose\":\"PHONE_VERIFICATION\"}"
check "otp/send returns 200" 200 '.success == true'

echo
echo "──────────────────────────────────────────────"
echo "  $PASS passed, $FAIL failed"
echo "──────────────────────────────────────────────"
[ "$FAIL" -eq 0 ]
