import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { getModerationPolicy } from "../lib/moderation/policies";
import { assertValidModerationTransition } from "../lib/moderation/lifecycle";

const root = path.resolve(__dirname, "..");

describe("Phase 1 moderation foundation", () => {
  it("uses centrally defined policy codes only for supported target types", () => {
    assert.equal(getModerationPolicy("FAKE_OR_INAUTHENTIC_REVIEW", "REVIEW")?.defaultSeverity, "MEDIUM");
    assert.equal(getModerationPolicy("FAKE_OR_INAUTHENTIC_REVIEW", "LISTING"), null);
    assert.equal(getModerationPolicy("SUSPECTED_FRAUD", "USER")?.defaultSeverity, "CRITICAL");
  });

  it("enforces the moderation lifecycle and only permits reopening terminal cases", () => {
    assert.doesNotThrow(() => assertValidModerationTransition("NEW", "IN_REVIEW"));
    assert.doesNotThrow(() => assertValidModerationTransition("RESOLVED", "REOPENED"));
    assert.throws(() => assertValidModerationTransition("NEW", "REOPENED"));
    assert.throws(() => assertValidModerationTransition("DISMISSED", "RESOLVED"));
  });

  it("keeps report intake and case management behind server-side authorization", () => {
    const reportRoute = fs.readFileSync(path.join(root, "app/api/v1/moderation/reports/route.ts"), "utf8");
    const caseRoute = fs.readFileSync(path.join(root, "app/api/v1/admin/moderation/cases/route.ts"), "utf8");
    const updateRoute = fs.readFileSync(path.join(root, "app/api/v1/admin/moderation/cases/[id]/route.ts"), "utf8");

    assert.match(reportRoute, /requireApiAuth/);
    assert.match(caseRoute, /requireApiPermission/);
    assert.match(updateRoute, /MODERATION_CASE_UPDATE/);
  });

  it("keeps Phase 2 dashboard reads and mutations permission-checked", () => {
    const summaryRoute = fs.readFileSync(path.join(root, "app/api/v1/admin/moderation/summary/route.ts"), "utf8");
    const moderatorsRoute = fs.readFileSync(path.join(root, "app/api/v1/admin/moderation/moderators/route.ts"), "utf8");
    const notesRoute = fs.readFileSync(path.join(root, "app/api/v1/admin/moderation/cases/[id]/notes/route.ts"), "utf8");
    const detailRoute = fs.readFileSync(path.join(root, "app/api/v1/admin/moderation/cases/[id]/route.ts"), "utf8");

    assert.match(summaryRoute, /requireApiPermission/);
    assert.match(moderatorsRoute, /MODERATION_CASE_ASSIGN/);
    assert.match(notesRoute, /MODERATION_DECISION_CREATE/);
    assert.match(detailRoute, /expectedUpdatedAt/);
  });

  it("fails closed with an actionable setup state when moderation tables are absent", () => {
    const service = fs.readFileSync(path.join(root, "services/moderation.service.ts"), "utf8");
    const pendingView = fs.readFileSync(path.join(root, "components/admin/moderation-setup-pending.tsx"), "utf8");
    assert.match(service, /to_regclass\('public\."ModerationCase"'\)::text/);
    assert.match(service, /Moderation setup is pending/);
    assert.match(pendingView, /divergent Prisma migration history/);
  });

  it("does not add enforcement calls to the Phase 2 moderation service", () => {
    const service = fs.readFileSync(path.join(root, "services/moderation.service.ts"), "utf8");
    assert.doesNotMatch(service, /bookingPayment\.update|bookingRefund\.create|payout\.update|review\.update|listing\.update/i);
    assert.match(service, /assertValidModerationTransition/);
    assert.match(service, /MODERATOR_ASSIGNED/);
    assert.match(service, /INTERNAL_NOTE_ADDED/);
  });

  it("makes moderation migration additive and leaves reviews, listings, disputes, and finance untouched", () => {
    const migration = fs.readFileSync(
      path.join(root, "prisma/migrations/20261014150000_moderation_foundation/migration.sql"),
      "utf8",
    );

    assert.match(migration, /CREATE TABLE "ModerationCase"/);
    assert.match(migration, /CREATE TABLE "ModerationReport"/);
    assert.match(migration, /CREATE TABLE "ModerationEvidence"/);
    assert.match(migration, /CREATE TABLE "ModerationActivity"/);
    assert.doesNotMatch(migration, /ALTER TABLE "Review"/);
    assert.doesNotMatch(migration, /ALTER TABLE "Listing"/);
    assert.doesNotMatch(migration, /ALTER TABLE "BookingPayment"/);
    assert.doesNotMatch(migration, /ALTER TABLE "BookingRefund"/);
    assert.doesNotMatch(migration, /DELETE FROM|DROP TABLE|TRUNCATE/i);
  });
});
