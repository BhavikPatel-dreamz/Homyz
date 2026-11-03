import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Guest Support Cache Invalidation, Race-Condition Safety & Client Performance", () => {
  test("implements HTTP cache-control headers and query cache busting in api client", () => {
    const file = source("components/profile/support-resolution-center.tsx");

    // Cache-Control & Pragma headers
    assert.match(file, /headers\.set\("Cache-Control",/);
    assert.match(file, /headers\.set\("Pragma",\s*"no-cache"\)/);
    // Cache busting timestamp in metrics queries
    assert.match(file, /const t = `&_t=\$\{Date\.now\(\)\}`;/);
  });

  test("prevents in-flight race conditions with request sequencing tokens for searches, tabs, and details", () => {
    const file = source("components/profile/support-resolution-center.tsx");

    // Sequence token references
    assert.match(file, /const casesReqSeqRef = useRef\(0\);/);
    assert.match(file, /const caseDetailReqSeqRef = useRef\(0\);/);

    // loadCases sequencing check
    assert.match(file, /const reqSeq = \+\+casesReqSeqRef\.current;/);
    assert.match(file, /if \(reqSeq !== casesReqSeqRef\.current\)/);

    // openCase sequencing check
    assert.match(file, /const reqSeq = \+\+caseDetailReqSeqRef\.current;/);
    assert.match(file, /activeRequestIdRef\.current === id\s*&&\s*reqSeq === caseDetailReqSeqRef\.current/);
  });

  test("optimistically prepends newly created cases and revalidates metrics & router cache immediately", () => {
    const file = source("components/profile/support-resolution-center.tsx");

    // Support request creation
    assert.match(file, /setItems\(\(prev\) =>\s*\[\s*createdCase,/);
    assert.match(file, /await loadMetrics\(\)/);
    assert.match(file, /router\.refresh\(\)/);
    assert.match(file, /void loadCases\(1, true\)/);

    // Direct resolution creation
    assert.match(file, /handleCreateDirectResolution/);
    assert.match(file, /\/api\/v1\/support\/cases\/\$\{encodeURIComponent\(\s*result\.supportCaseId,?\s*\)\}\?_t=\$\{Date\.now\(\)\}/);
  });

  test("notifies parent listing and metrics upon case mutations (messages, evidence, offers, mediation)", () => {
    const file = source("components/profile/support-resolution-center.tsx");

    // Prop declaration
    assert.match(file, /onCaseMutated\?: \(updatedFields\?: Partial<Case>\) => void/);

    // Calling mutation callbacks
    assert.match(file, /onCaseMutated\?\.\(\{\s*updatedAt: new Date\(\)\.toISOString\(\),?\s*\}\)/);
    assert.match(file, /status:\s*action === "ACCEPT" \? "RESOLVED" : caseData\.status/);
    assert.match(file, /onCaseMutated\?\.\(\{\s*status: "ESCALATED",\s*updatedAt: new Date\(\)\.toISOString\(\),?\s*\}\)/);

    // Parent handler updates state and server cache
    assert.match(file, /function handleCaseMutated\(updatedFields\?: Partial<Case>\)/);
    assert.match(file, /void loadCases\(page, true\)/);
  });

  test("provides geometric skeletons matching card layout and obeys GEMINI.md typography rules", () => {
    const file = source("components/profile/support-resolution-center.tsx");

    // Geometric listing skeleton
    assert.match(file, /aria-label="Loading support cases"/);
    assert.match(file, /size-14 sm:size-16 rounded-xl bg-zinc-200 shrink-0/);

    // Strict GEMINI.md typography rules
    const matches = file.match(/\b(font-bold|font-semibold)\b|<b\b|<strong\b/g);
    assert.equal(matches, null, `Found forbidden font weight classes: ${matches?.join(", ")}`);
  });
});
