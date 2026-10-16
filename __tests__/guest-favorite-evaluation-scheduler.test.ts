import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("daily Guest Favorite evaluator is leased, batched, and isolates listing failures", () => {
  const service = read("services/guest-favorite.service.ts");

  assert.match(service, /acquireCacheLease\(CACHE_KEYS\.GUEST_FAVORITE_EVALUATION_LOCK\(\), 30 \* 60\)/);
  assert.match(service, /releaseCacheLease\(lease\)/);
  assert.match(service, /listingPageSize = 100/);
  assert.match(service, /evaluationBatchSize = 20/);
  assert.match(service, /getConfirmedQualityIncidentCounts\(listingIds\)/);
  assert.match(service, /listing evaluation failed/);
  assert.match(service, /incident lookup failed/);
  assert.match(service, /\[guest-favorite-evaluation\] completed/);
  assert.match(service, /guestFavoriteEvaluation\.upsert/);
});

test("internal endpoint, systemd timer, and host runner stay private", () => {
  const route = read("app/api/internal/guest-favorite/evaluations/route.ts");
  const runner = read("scripts/deploy/run-guest-favorite-evaluation.sh");
  const service = read("deploy/homyz-guest-favorite-evaluation.service");
  const timer = read("deploy/homyz-guest-favorite-evaluation.timer");
  const env = read(".env.example");

  assert.match(route, /GUEST_FAVORITE_EVALUATION_CRON_SECRET/);
  assert.match(route, /hasValidCronAuthorization/);
  assert.match(route, /timingSafeEqual/);
  assert.match(runner, /127\.0\.0\.1:3000/);
  assert.match(runner, /Authorization: Bearer/);
  assert.match(service, /EnvironmentFile=-%h\/homyz\/\.env/);
  assert.match(timer, /OnCalendar=\*-\*-\* 03:15:00 UTC/);
  assert.match(timer, /Persistent=true/);
  assert.match(env, /GUEST_FAVORITE_EVALUATION_CRON_SECRET/);
});

test("host cancellations immediately reconcile only the affected Guest Favorite listing", () => {
  const bookingService = read("services/booking.service.ts");
  const hostCancellation = bookingService.match(
    /async function cancelBookingByHost[\s\S]*?\n}\n\nasync function listForAdminDashboard/,
  )?.[0];
  const guestCancellation = bookingService.match(
    /async function cancelBookingByGuest[\s\S]*?\n}\n\nasync function cancelBookingByHost/,
  )?.[0];

  assert.ok(hostCancellation, "host cancellation implementation should be present");
  assert.ok(guestCancellation, "guest cancellation implementation should be present");
  assert.match(hostCancellation, /cancelledBy: "HOST"/);
  assert.match(hostCancellation, /triggerGuestFavoriteReevaluation\(cancelled\.listingId\)/);
  assert.doesNotMatch(guestCancellation, /triggerGuestFavoriteReevaluation/);
});
