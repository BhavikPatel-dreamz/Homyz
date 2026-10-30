import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Guest Resolution Center Navigation & UI Consolidation", () => {
  test("legacy /profile/resolution-center safely redirects to /profile/tab/support?view=direct preserving caseId", () => {
    const legacyPage = source("app/(protected)/profile/resolution-center/page.tsx");

    assert.match(legacyPage, /redirect\(`\/profile\/tab\/support\?\$\{query\.toString\(\)\}`\)/);
    assert.match(legacyPage, /query\.set\("view",\s*"direct"\)/);
    assert.match(legacyPage, /query\.set\("caseId",\s*value\)/);
  });

  test("support workspace implements primary navigation between Support Requests and Direct Resolutions", () => {
    const workspace = source("components/profile/support-resolution-center.tsx");

    assert.match(workspace, /switchPrimaryView\("support"\)/);
    assert.match(workspace, /switchPrimaryView\("direct"\)/);
    assert.match(workspace, /Support Requests/);
    assert.match(workspace, /Direct Resolutions/);
    assert.match(workspace, /params\.set\("resolutionOnly",\s*"true"\)/);
  });

  test("direct resolution detail mode provides all 5 functional tabs and working negotiation & mediation actions", () => {
    const workspace = source("components/profile/support-resolution-center.tsx");

    // All 5 tabs
    assert.match(workspace, /Conversation \(\{caseData\.messages\?\.length \|\| 0\}\)/);
    assert.match(workspace, /Offers &amp; Negotiation/);
    assert.match(workspace, /Evidence \(\{caseData\.evidence\?\.length \|\| 0\}\)/);
    assert.match(workspace, /Activity\s*<\/button>/);
    assert.match(workspace, /Mediation\s*<\/button>/);

    // Offer Actions
    assert.match(workspace, /\/api\/v1\/support\/resolution-offers\/\$\{offer\.id\}\/action/);
    assert.match(workspace, /handleOfferAction\(activePendingOffer,\s*"ACCEPT"\)/);
    assert.match(workspace, /handleOfferAction\(activePendingOffer,\s*"REJECT"\)/);
    assert.match(workspace, /handleOfferAction\(activePendingOffer,\s*"WITHDRAW"\)/);

    // Mediation Request
    assert.match(workspace, /\/api\/v1\/support\/cases\/\$\{caseData\.id\}\/mediation/);
    assert.match(workspace, /handleRequestMediation/);

    // New Resolution Request creation
    assert.match(workspace, /\/api\/v1\/support\/resolutions/);
    assert.match(workspace, /handleCreateDirectResolution/);
  });

  test("notification deep links direct guests into the consolidated workspace", () => {
    const resolutionService = source("services/resolution-offer.service.ts");
    const supportService = source("services/support-case.service.ts");

    assert.match(resolutionService, /\/profile\/tab\/support\?view=direct&caseId=/);
    assert.match(supportService, /\/profile\/tab\/support\?view=direct&caseId=/);
  });

  test("complies with GEMINI.md typography rules (no bold or semibold in components)", () => {
    const workspace = source("components/profile/support-resolution-center.tsx");
    const matches = workspace.match(/\b(font-bold|font-semibold)\b|<b\b|<strong\b/g);
    assert.equal(matches, null, `Found forbidden font-weight classes: ${matches?.join(", ")}`);
  });
});
