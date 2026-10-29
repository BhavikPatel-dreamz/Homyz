import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 12 reconciliation runs have durable identities, checkpoints, audit provenance, and safe lifecycle states", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261029100000_add_stayelite_reconciliation_runs/migration.sql");
  assert.match(schema, /model StayEliteReconciliationRun/);
  assert.match(schema, /correlationId\s+String\s+@unique/);
  assert.match(schema, /idempotencyKey\s+String\s+@unique/);
  assert.match(schema, /enum StayEliteReconciliationStatus[\s\S]*COMPLETED_WITH_ISSUES/);
  assert.match(schema, /cursor\s+String\?/);
  assert.match(migration, /CREATE TABLE "StayEliteReconciliationRun"/);
  assert.match(migration, /FOREIGN KEY \("initiatedById"\)/);
});

test("reconciliation defaults to reports and restricts the only mutation mode to explicitly enabled booking evidence", () => {
  const service = read("services/stayelite-reconciliation.service.ts");
  assert.match(service, /mode \?\? StayEliteReconciliationMode\.DRY_RUN/);
  assert.match(service, /EVIDENCE_ONLY && input\.domain !== StayEliteReconciliationDomain\.BOOKING_EVIDENCE/);
  assert.match(service, /reconcileAchievementEvidence/);
  assert.match(service, /persistEvidence: run\.mode === StayEliteReconciliationMode\.EVIDENCE_ONLY/);
  assert.match(service, /persist: false/);
  assert.match(service, /No authoritative .* exists in this repository/);
  assert.doesNotMatch(service, /achievementAward\.create|stayEliteMembership\.(create|update)|referralReward\.(create|update)/);
});

test("admin reconciliation routes require RBAC and keep creation distinct from execution", () => {
  const permissions = read("lib/permissions/permissions.ts");
  const route = read("app/api/v1/admin/loyalty/reconciliation/route.ts");
  const execute = read("app/api/v1/admin/loyalty/reconciliation/[id]/run/route.ts");
  assert.match(permissions, /LOYALTY_RECONCILIATION_VIEW/);
  assert.match(permissions, /LOYALTY_RECONCILIATION_EVIDENCE_BACKFILL/);
  assert.match(route, /createStayEliteReconciliationRun/);
  assert.doesNotMatch(route, /executeStayEliteReconciliationRun/);
  assert.match(execute, /LOYALTY_RECONCILIATION_EVIDENCE_BACKFILL/);
});
