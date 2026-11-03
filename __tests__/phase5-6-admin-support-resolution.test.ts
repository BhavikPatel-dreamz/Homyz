import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Phase 5 + 6 — admin support and direct resolutions", () => {
  test("migration is additive and models versioned resolution offers", () => {
    const migration = source("prisma/migrations/20261029140000_add_support_case_admin_resolution_offers/migration.sql");
    const schema = source("prisma/schema.prisma");
    assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
    assert.match(migration, /CREATE TABLE "ResolutionOffer"/);
    assert.match(schema, /model ResolutionOffer/);
    assert.match(schema, /version\s+Int\s+@default\(1\)/);
    assert.match(schema, /idempotencyKey\s+String\?\s+@unique/);
  });

  test("support administration enforces explicit dispute permissions", () => {
    const dashboard = source("app/api/v1/admin/support/dashboard/route.ts");
    const agents = source("app/api/v1/admin/support/agents/route.ts");
    const priority = source("app/api/v1/support/cases/[id]/priority/route.ts");
    const escalation = source("app/api/v1/support/cases/[id]/escalation/route.ts");
    assert.match(dashboard, /PERMISSIONS\.DISPUTES_VIEW/);
    assert.match(agents, /PERMISSIONS\.DISPUTES_VIEW/);
    assert.match(priority, /PERMISSIONS\.DISPUTES_MANAGE/);
    assert.match(escalation, /PERMISSIONS\.DISPUTES_MANAGE/);
  });

  test("SLA deadlines are derived server-side and list filters support unassigned and resolution-only views", () => {
    const service = source("services/support-case.service.ts");
    assert.match(service, /getSupportSlaDeadlines\(priority, now\)/);
    assert.match(service, /query\.assignedAdminId === "unassigned" \? null/);
    assert.match(service, /resolutionOffers: \{ some: \{\} \}/);
    assert.match(service, /query\.slaState === "BREACHED"/);
    assert.match(service, /assignmentHistory: access\.admin/);
  });

  test("offer actions have optimistic locking, expiration handling, and party authorization", () => {
    const service = source("services/resolution-offer.service.ts");
    assert.match(service, /offer\.version !== input\.expectedVersion/);
    assert.match(service, /status: ResolutionOfferStatus\.EXPIRED/);
    assert.match(service, /offer\.proposerId === actor\.id/);
    assert.match(service, /offer\.recipientId === actor\.id/);
    assert.match(service, /MAX_NEGOTIATION_ROUNDS/);
    assert.match(service, /parent\.recipientId !== actor\.id/);
  });

  test("accepted offers only link an existing refund request and never execute a refund or payout", () => {
    const service = source("services/resolution-offer.service.ts");
    const linking = service.slice(service.indexOf("async function linkResolutionOfferRefund"), service.indexOf("async function createResolutionRequest"));
    assert.match(linking, /resolutionOfferId: offer\.id/);
    assert.match(linking, /supportCaseId: offer\.caseId/);
    assert.doesNotMatch(linking, /processRefund|issueRefund|createPayout|processPayout/);
  });

  test("guest and host direct centers restrict cases, actions, and evidence access", () => {
    const client = source("components/resolution/direct-resolution-center.tsx");
    const offers = source("app/api/v1/support/cases/[id]/resolution-offers/route.ts");
    assert.match(client, /resolutionOnly=true/);
    assert.match(client, /active\.viewer\.id === offer\.recipient\.id/);
    assert.match(client, /active\.viewer\.id === offer\.proposer\.id/);
    assert.match(client, /parentOfferId: countering\?\.id/);
    assert.match(client, /evidence\/upload/);
    assert.match(offers, /requireApiAuth/);
  });
});
