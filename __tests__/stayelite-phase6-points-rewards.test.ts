import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ZERO_CANCEL_PRO_BONUS_POINTS,
  applyPointsLedgerDelta,
  isPointsRedemptionEnabled,
} from "@/services/stayelite-points-rewards.service";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("points projection protects balance invariants and preserves the only approved numeric bonus", () => {
  assert.equal(ZERO_CANCEL_PRO_BONUS_POINTS, 300);
  const earned = applyPointsLedgerDelta({ available: 0, pending: 0, reserved: 0 }, {
    amount: 300, availableDelta: 300, pendingDelta: 0, reservedDelta: 0,
  });
  const reserved = applyPointsLedgerDelta(earned, {
    amount: 250, availableDelta: -250, pendingDelta: 0, reservedDelta: 250,
  });
  assert.deepEqual(reserved, { available: 50, pending: 0, reserved: 250 });
  assert.throws(() => applyPointsLedgerDelta(reserved, {
    amount: 51, availableDelta: -51, pendingDelta: 0, reservedDelta: 51,
  }), /negative balance/);
  assert.equal(isPointsRedemptionEnabled(), false);
});

test("points, reward, and campaign foundations are database constrained and have no public activation route", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261029110000_add_stayelite_points_rewards_campaigns/migration.sql");
  const service = read("services/stayelite-points-rewards.service.ts");
  assert.match(schema, /model PointsAccount/);
  assert.match(schema, /model PointsLedgerEntry/);
  assert.match(schema, /model RewardDefinition/);
  assert.match(schema, /model RewardRedemption/);
  assert.match(schema, /model LoyaltyCampaign/);
  assert.match(migration, /PointsAccount_availableBalance_nonnegative/);
  assert.match(migration, /PointsLedgerEntry_no_update/);
  assert.match(migration, /PointsLedgerEntry_no_delete/);
  assert.match(migration, /PointsLedgerEntry_idempotencyKey_key/);
  assert.match(service, /availableBalance: \{ gte: reward\.pointsCost \}/);
  assert.match(service, /STAYELITE_POINTS_REDEMPTION_ENABLED/);
  assert.equal(fs.existsSync(path.join(process.cwd(), "app/api/v1/loyalty/redemptions/route.ts")), false);
});
