import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { AchievementEventType, TravelStampOwnership } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import {
  isAutomaticAchievementAwardingEnabled,
  processAchievementEvent,
  recordTrustedAchievementEvent,
} from "@/services/achievement-event.service";
import { removeTravelStamp } from "@/services/travel-stamp.service";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("completion events use a server-only automatic stamp-award path and have no public arbitrary event route", () => {
  const schema = read("prisma/schema.prisma");
  const events = read("services/achievement-event.service.ts");
  const reconciliation = read("services/achievement-reconciliation.service.ts");
  const migration = read("prisma/migrations/20261028130000_add_stayelite_event_foundation/migration.sql");

  assert.equal(isAutomaticAchievementAwardingEnabled(), true);
  assert.match(schema, /model AchievementEvent/);
  assert.match(schema, /model BookingVisitEvidence/);
  assert.match(schema, /ownership\s+TravelStampOwnership\s+@default\(USER_MANAGED\)/);
  assert.match(events, /recordStayCompletionCandidateEvent/);
  assert.match(events, /awardSystemTravelStamps/);
  assert.match(events, /idempotencyKey:\s*string/);
  assert.match(reconciliation, /dryRun = options\.dryRun !== false/);
  assert.match(reconciliation, /STAYELITE_EVIDENCE_BACKFILL_ENABLED/);
  assert.match(migration, /AchievementEvent_idempotencyKey_key/);
  assert.ok(!fs.existsSync(path.join(process.cwd(), "app/api/v1/achievements/events/route.ts")));
});

test("parallel delivery is idempotent, non-completion events do not award, and system stamps cannot be removed", async (t) => {
  if (process.env.STAYELITE_DB_TESTS !== "true") {
    t.skip("Set STAYELITE_DB_TESTS=true only for an explicitly approved isolated database.");
    return;
  }
  try {
    await prisma.achievementEvent.count({ take: 1 });
  } catch (error: any) {
    if (["P2021", "P1001", "P1017"].includes(error?.code)) {
      t.skip("A reachable test database with the Phase 2 migration is required for this database-backed test.");
      return;
    }
    throw error;
  }

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({ data: { email: `stayelite-phase2-${nonce}@example.test` } });
  t.after(async () => {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  });

  const idempotencyKey = `test:achievement-event:${nonce}`;
  const [first, second] = await Promise.all([
    recordTrustedAchievementEvent({
      type: AchievementEventType.BOOKING_CONFIRMED,
      sourceEntityType: "BOOKING",
      sourceEntityId: `source-${nonce}`,
      userId: user.id,
      occurredAt: new Date(),
      idempotencyKey,
    }),
    recordTrustedAchievementEvent({
      type: AchievementEventType.BOOKING_CONFIRMED,
      sourceEntityType: "BOOKING",
      sourceEntityId: `source-${nonce}`,
      userId: user.id,
      occurredAt: new Date(),
      idempotencyKey,
    }),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(await prisma.achievementEvent.count({ where: { idempotencyKey } }), 1);

  const processed = await processAchievementEvent(first.id, "phase2-test-worker");
  assert.equal(processed.awardIssued, false);
  assert.equal(await prisma.achievementAward.count({ where: { userId: user.id } }), 0);

  const stamp = await prisma.travelStamp.create({
    data: {
      slug: `phase2-stamp-${nonce}`,
      displayName: "Protected system stamp",
      category: "MILESTONE",
      eligibilityRule: "PHASE_2_TEST",
    },
  });
  const systemStamp = await prisma.userTravelStamp.create({
    data: { userId: user.id, stampId: stamp.id, ownership: TravelStampOwnership.SYSTEM_AWARDED },
  });
  await assert.rejects(
    () => removeTravelStamp(user.id, systemStamp.id),
    /System-awarded stamps cannot be removed/,
  );
  assert.ok(await prisma.userTravelStamp.findUnique({ where: { id: systemStamp.id } }));
});
