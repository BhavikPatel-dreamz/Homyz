import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Host Help & Resolution Center consolidation", () => {
  test("uses the support route as the only host menu entry", () => {
    const header = source("components/dashboard/app-header.tsx");

    assert.match(header, /href="\/host\/support"/);
    assert.match(header, /Help &amp; Resolution Center/);
    assert.doesNotMatch(header, /href="\/host\/resolution-center"/);
  });

  test("combines support cases and unlinked legacy disputes without a duplicate row", () => {
    const center = source("components/host/support/host-support-center.tsx");
    const disputes = source("services/dispute.service.ts");

    assert.match(center, /\/api\/v1\/support\/cases/);
    assert.match(center, /\/api\/v1\/host\/disputes/);
    assert.match(center, /filter\(\(dispute\) => !dispute\.supportCaseId\)/);
    assert.match(center, /Booking dispute/);
    assert.match(disputes, /supportCaseId: incident\.supportCase\?\.id \|\| null/);
  });

  test("preserves legacy URLs by redirecting them to the unified host entry", () => {
    const legacyList = source("app/(protected)/host/resolution-center/page.tsx");
    const legacyDirect = source("app/(protected)/host/resolution-center/direct/page.tsx");

    assert.match(legacyList, /redirect\(`\/host\/support/);
    assert.match(legacyDirect, /redirect\(`\/host\/support\?view=direct/);
  });

  test("keeps direct negotiation inside the consolidated host experience", () => {
    const center = source("components/host/support/host-support-center.tsx");
    const direct = source("components/resolution/direct-resolution-center.tsx");

    assert.match(center, /<DirectResolutionCenter audience="host" initialCaseId=\{initialCaseId\} embedded/);
    assert.doesNotMatch(center, /return <DirectResolutionCenter audience="host"/);
    assert.match(direct, /Guest–host discussion/);
    assert.match(direct, /\/messages/);
    assert.match(direct, /\/mediation/);
    assert.match(direct, /active\.status === "ESCALATED"/);
    assert.match(direct, /href="\/host\/today"/);
    assert.match(center, /href="\/host\/today"/);
    assert.match(direct, /className="w-full space-y-6"/);
    assert.match(direct, /Help and Resolution Center case views/);
    assert.match(direct, /Booking Disputes/);
    assert.match(direct, /Direct Resolutions/);
    assert.match(center, /function supportTab/);
    assert.match(center, /function tabFromSearchParams/);
    assert.match(center, /view === "direct"/);
    assert.match(direct, /router\.push\(`\/host\/support\?view=direct&caseId=/);
  });
});
