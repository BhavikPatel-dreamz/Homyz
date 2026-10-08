import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getRecentlyViewedProperties,
  RECENT_VIEWED_KEY,
  saveRecentlyViewedProperty,
} from "../lib/storage/client-history";

test("recently viewed storage preserves official listing and host badge flags", () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  const previousLocalStorage = globalThis.localStorage;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });

  try {
    saveRecentlyViewedProperty({
      id: "qualified-listing",
      title: "Qualified stay",
      price: 200,
      mainImage: "/qualified.jpg",
      isGuestFavorite: true,
      isSuperhost: true,
    });

    const [stored] = getRecentlyViewedProperties();
    assert.equal(stored.id, "qualified-listing");
    assert.equal(stored.isGuestFavorite, true);
    assert.equal(stored.isSuperhost, true);
    assert.ok(values.has(RECENT_VIEWED_KEY));
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: previousLocalStorage,
    });
  }
});

test("listing detail stores official badges and Recently Viewed refreshes them from a batched public-card response", () => {
  const detail = fs.readFileSync(
    path.join(process.cwd(), "app/listings/[id]/public-listing-detail-client.tsx"),
    "utf8",
  );
  const home = fs.readFileSync(
    path.join(process.cwd(), "components/home/home-view.tsx"),
    "utf8",
  );

  assert.match(detail, /isGuestFavorite:\s*listing\.isGuestFavorite === true/);
  assert.match(detail, /isSuperhost:\s*listing\.host\?\.isSuperhost === true/);
  assert.match(home, /\/api\/v1\/listings\/cards\?ids=/);
  assert.match(home, /currentRecentBadges/);
  assert.match(home, /isGuestFavorite,\n\s*isSuperhost,/);
});
