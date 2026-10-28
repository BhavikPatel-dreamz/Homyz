import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("listing cards retain Superhost visibility when a listing is also a Guest Favorite", () => {
  const homeCard = read("components/home/property-card.tsx");
  const searchCard = read("components/listings/listing-card.tsx");
  const mapPreview = read("app/listings/listings-results-client.tsx");

  for (const source of [homeCard, searchCard, mapPreview]) {
    assert.match(source, /showGuestFavorite/);
    assert.match(source, /showSuperhost/);
  }

  assert.match(homeCard, /\{showGuestFavorite && \(/);
  assert.match(homeCard, /\{showSuperhost && \(/);
  assert.match(searchCard, /\{showGuestFavorite && \(/);
  assert.match(searchCard, /\{showSuperhost && \(/);
  assert.match(mapPreview, /\{showGuestFavorite && \(/);
  assert.match(mapPreview, /\{showSuperhost && \(/);
});

test("the mobile listing detail keeps the same persisted Superhost badge", () => {
  const detail = read("app/listings/[id]/public-listing-detail-client.tsx");

  assert.match(detail, /mb-4 space-y-2 lg:hidden/);
  assert.match(detail, /<SuperhostBadge active=\{listing\.host\?\.isSuperhost\} \/>/);
});
