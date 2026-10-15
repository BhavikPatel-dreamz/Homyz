import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("admin moderation case details keep valid cases out of the 404 path", async (t) => {
  await t.test("listing target queries use the current BookingStatus enum", () => {
    const service = source("services/moderation.service.ts");

    assert.match(service, /BookingStatus\.PENDING/);
    assert.match(service, /BookingStatus\.CONFIRMED/);
    assert.match(service, /user:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*email:\s*true/);
    assert.doesNotMatch(service, /status:\s*\{\s*in:\s*\[[^\]]*"CHECKED_IN"/);
  });

  await t.test("review target summaries use the generated ReviewResponse field names", () => {
    const service = source("services/moderation.service.ts");
    const client = source("app/(protected)/admin/moderation/cases/[id]/admin-moderation-case-details-client.tsx");

    assert.match(service, /response:\s*\{\s*select:\s*\{\s*id:\s*true,\s*comment:\s*true,\s*createdAt:\s*true,\s*author:/);
    assert.match(client, /data\.response\.author\?\.name/);
    assert.match(client, /data\.response\.comment/);
  });

  await t.test("only missing or deliberately hidden cases become a 404", () => {
    const page = source("app/(protected)/admin/moderation/cases/[id]/page.tsx");

    assert.match(page, /error\.status === 403 \|\| error\.status === 404/);
    assert.match(page, /throw error/);
  });

  await t.test("case list links use canonical case IDs for deep links", () => {
    const cases = source("app/(protected)/admin/moderation/admin-moderation-cases-client.tsx");

    assert.match(cases, /\/admin\/moderation\/cases\/\$\{item\.id\}/);
    assert.doesNotMatch(cases, /\/admin\/moderation\/cases\/\$\{item\.caseReference\}/);
  });
});
