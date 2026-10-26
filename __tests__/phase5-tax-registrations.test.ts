import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("tax registration API exposes an authenticated, host-scoped GET endpoint", () => {
  const route = read("app/api/v1/taxes/registrations/route.ts");
  const service = read("services/tax.service.ts");

  assert.match(route, /export const GET = apiHandler/);
  assert.match(route, /requireApiAuth\(req\)/);
  assert.match(route, /taxService\.getTaxRegistrations\(actor\)/);
  assert.match(service, /async getTaxRegistrations\(actor: AuthUser\)/);
  assert.match(service, /where: \{ hostId: actor\.id \}/);
  assert.match(service, /include: \{ jurisdiction: true \}/);
});
