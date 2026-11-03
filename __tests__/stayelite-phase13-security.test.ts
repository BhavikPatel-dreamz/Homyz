import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("runtime code contains no embedded secret fallback and database tests require explicit isolation", () => {
  const cartoLayer = read("components/listings/carto-tile-layer.tsx");
  const searchMap = read("components/listings/search-map.tsx");
  const previewToken = read("lib/cms/preview-token.ts");
  const payoutEncryption = read("lib/security/payout-encryption.ts");
  const eventTest = read("__tests__/stayelite-phase2-event-foundation.test.ts");

  assert.doesNotMatch(cartoLayer, /NEXT_PUBLIC_CARTO_API_KEY\s*\?\?\s*["'][^"']+/);
  assert.doesNotMatch(searchMap, /NEXT_PUBLIC_CARTO_API_KEY\s*\?\?\s*["'][^"']+/);
  assert.doesNotMatch(previewToken, /cms_preview_secret/i);
  assert.doesNotMatch(payoutEncryption, /fallback-payout-encryption/i);
  assert.match(payoutEncryption, /PAYOUT_ENCRYPTION_KEY/);
  assert.match(eventTest, /STAYELITE_DB_TESTS !== "true"/);
});
