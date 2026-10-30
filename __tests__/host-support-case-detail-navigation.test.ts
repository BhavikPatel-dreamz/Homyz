import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Host Support Case Detail Navigation", () => {
  test("dedicated case detail route and skeleton loading files exist", () => {
    assert.equal(existsSync(join(process.cwd(), "app/(protected)/host/support/cases/[caseId]/page.tsx")), true);
    assert.equal(existsSync(join(process.cwd(), "app/(protected)/host/support/cases/[caseId]/loading.tsx")), true);
    assert.equal(existsSync(join(process.cwd(), "components/host/support/host-case-detail-client.tsx")), true);

    const pageContent = source("app/(protected)/host/support/cases/[caseId]/page.tsx");
    assert.match(pageContent, /requirePageRole\(\[Role\.HOST\]\)/);
    assert.match(pageContent, /HostCaseDetailClient/);
  });

  test("main host support page redirects existing URLs containing caseId to dedicated page", () => {
    const pageContent = source("app/(protected)/host/support/page.tsx");
    assert.match(pageContent, /if \(caseId\)/);
    assert.match(pageContent, /redirect\(`\/host\/support\/cases\/\$\{encodeURIComponent\(caseId\)\}\$\{qs\}`\)/);
  });

  test("host resolution center legacy routes safely redirect caseId to dedicated page", () => {
    const directContent = source("app/(protected)/host/resolution-center/direct/page.tsx");
    assert.match(directContent, /if \(caseId\)/);
    assert.match(directContent, /redirect\(`\/host\/support\/cases\/\$\{encodeURIComponent\(caseId\)\}\?view=direct`\)/);

    const legacyContent = source("app/(protected)/host/resolution-center/page.tsx");
    assert.match(legacyContent, /if \(caseId\)/);
    assert.match(legacyContent, /redirect\(`\/host\/support\/cases\/\$\{encodeURIComponent\(caseId\)\}\$\{qs\}`\)/);
  });

  test("clicking case rows in host support center navigates to dedicated case page", () => {
    const center = source("components/host/support/host-support-center.tsx");

    // All seven tabs are retained together
    assert.match(center, /id: "all", label: `All Cases/);
    assert.match(center, /id: "support", label: "Support Requests"/);
    assert.match(center, /id: "booking_disputes", label: "Booking Disputes"/);
    assert.match(center, /id: "direct", label: "Direct Resolutions"/);
    assert.match(center, /id: "action_needed", label: "Action Needed from You"/);
    assert.match(center, /id: "in_review", label: "Under Review"/);
    assert.match(center, /id: "resolved", label: "Resolved & Closed"/);

    // Navigates to dedicated page
    assert.match(center, /router\.push\(`\/host\/support\/cases\/\$\{encodeURIComponent\(targetCaseId\)\}\$\{qs\}`\)/);
    assert.match(center, /onClick=\{\(\) => handleSelectCase\(item\.id\)\}/);
    assert.match(center, /onSelectCase=\{handleSelectCase\}/);
  });

  test("direct resolution center supports onSelectCase callback", () => {
    const direct = source("components/resolution/direct-resolution-center.tsx");
    assert.match(direct, /onSelectCase\?: \(caseId: string\) => void/);
    assert.match(direct, /if \(onSelectCase\) onSelectCase\(item\.id\); else void open\(item\.id\);/);
    assert.match(direct, /if \(onSelectCase\) \{\s*onSelectCase\(result\.supportCaseId\);/);
  });

  test("dedicated case detail client provides overview, discussion, offers, evidence, activity, mediation, and back navigation", () => {
    const detail = source("components/host/support/host-case-detail-client.tsx");

    // Overview & Back navigation
    assert.match(detail, /buildReturnHref/);
    assert.match(detail, /getReturnLabel/);
    assert.match(detail, /href="\/host\/today"/);
    assert.match(detail, /Inquiry Description/);

    // Discussion & Messages
    assert.match(detail, /Guest–host discussion/);
    assert.match(detail, /Support Communication/);
    assert.match(detail, /\/messages/);

    // Offers & Negotiation
    assert.match(detail, /Negotiation history &amp; offers/);
    assert.match(detail, /\/resolution-offers/);
    assert.match(detail, /handleOfferAction/);

    // Supporting Evidence
    assert.match(detail, /Evidence &amp; Documents/);
    assert.match(detail, /\/evidence\/upload/);
    assert.match(detail, /\/evidence\/\$\{entry\.id\}\?download=true/);

    // Case Activity Timeline
    assert.match(detail, /Case activity/);

    // Mediation Request
    assert.match(detail, /Request mediation/);
    assert.match(detail, /\/mediation/);
  });

  test("complies with GEMINI.md typography rules (no bold or semibold in host components)", () => {
    const detail = source("components/host/support/host-case-detail-client.tsx");
    const center = source("components/host/support/host-support-center.tsx");

    assert.doesNotMatch(detail, /font-bold/);
    assert.doesNotMatch(detail, /font-semibold/);
    assert.doesNotMatch(detail, /<b>/);
    assert.doesNotMatch(detail, /<strong>/);

    assert.doesNotMatch(center, /font-bold/);
    assert.doesNotMatch(center, /font-semibold/);
    assert.doesNotMatch(center, /<b>/);
    assert.doesNotMatch(center, /<strong>/);
  });
});

