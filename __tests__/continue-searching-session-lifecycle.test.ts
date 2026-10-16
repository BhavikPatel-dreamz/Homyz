import assert from "node:assert/strict";
import {
  saveLastSearch,
  getLastSearch,
  clearLastSearch,
  markSearchInCurrentSession,
  isSearchInCurrentSession,
  shouldShowContinueSearching,
  ACTIVE_SESSION_SEARCH_KEY,
  LAST_SEARCH_KEY,
  LAST_SEARCH_COOKIE,
  SEARCH_SESSION_COOKIE,
} from "@/lib/storage/client-history";
import fs from "node:fs";
import path from "node:path";

async function runSessionLifecycleTests() {
  console.log("\n==================================================================");
  console.log("   CONTINUE SEARCHING BAR - SESSION & TAB CLOSE LIFECYCLE AUDIT   ");
  console.log("==================================================================\n");

  let mockLocalStorage: Record<string, string> = {};
  let mockSessionStorage: Record<string, string> = {};
  let mockCookies: Record<string, string> = {};

  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => mockLocalStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockLocalStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockLocalStorage[k];
      },
      clear: () => {
        mockLocalStorage = {};
      },
    },
    sessionStorage: {
      getItem: (k: string) => mockSessionStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockSessionStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockSessionStorage[k];
      },
      clear: () => {
        mockSessionStorage = {};
      },
    },
    dispatchEvent: () => true,
  };
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
  (globalThis as any).sessionStorage = (globalThis as any).window.sessionStorage;
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    constructor(t: string) {
      this.type = t;
    }
  };

  Object.defineProperty(globalThis, "document", {
    value: {
      get cookie() {
        return Object.entries(mockCookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; ");
      },
      set cookie(val: string) {
        const [pair] = val.split(";");
        const [k, v] = pair.split("=");
        if (k) {
          mockCookies[k.trim()] = v ? v.trim() : "";
        }
      },
    },
    writable: true,
    configurable: true,
  });

  // Global fetch mock to silence /api/v1/search/track background calls
  (globalThis as any).fetch = async () => ({ ok: true });

  // --------------------------------------------------------------------------
  // [1] User searches in active session -> Navigates back to Home -> MUST NOT SHOW
  // --------------------------------------------------------------------------
  console.log("--- [1] Active Search Session (Navigating back to Home Page) ---");

  // User searches for Times Square with dates
  const saved = saveLastSearch({
    query: "Times Square",
    displayName: "Times Square, New York, NY",
    placeType: "landmark",
    city: "New York",
    latitude: 40.758,
    longitude: -73.9855,
    checkIn: "2026-09-18",
    checkOut: "2026-09-30",
    guests: 2,
  });

  assert(saved !== null, "Search must be saved successfully");
  assert.equal(isSearchInCurrentSession(), true, "Must mark search as active in current session/tab");
  assert.equal(mockSessionStorage[ACTIVE_SESSION_SEARCH_KEY], "true", "sessionStorage must record active session");

  // User comes back to homepage in the SAME tab/session (e.g. clicking Homyz logo)
  const currentSearch = getLastSearch();
  const shouldShowOnHomeReturn = shouldShowContinueSearching(currentSearch);

  assert.equal(
    shouldShowOnHomeReturn,
    false,
    "Continue searching bar MUST NOT show when user simply comes back to homepage during the same session"
  );
  console.log("  ✓ When user returns to homepage within the same session/tab, bar is hidden (shouldShow = false)");

  // --------------------------------------------------------------------------
  // [2] User closes tab or closes session -> Returns in new session -> MUST SHOW
  // --------------------------------------------------------------------------
  console.log("\n--- [2] Tab Close / Session End & Re-engagement ---");

  // Simulate tab close / session close: browser destroys sessionStorage
  mockSessionStorage = {};
  delete mockCookies[SEARCH_SESSION_COOKIE];

  assert.equal(isSearchInCurrentSession(), false, "sessionStorage is cleared upon tab/session close");

  // User reopens the website in a new tab/session
  const returningSearch = getLastSearch();
  assert(returningSearch !== null, "Previous search must persist across tab close in localStorage / persistent cookie");

  const shouldShowOnReturn = shouldShowContinueSearching(returningSearch);
  assert.equal(
    shouldShowOnReturn,
    true,
    "Continue searching bar MUST show when user returns after closing session or tab"
  );
  console.log("  ✓ When user returns after closing tab/session, bar is shown (shouldShow = true)");

  // --------------------------------------------------------------------------
  // [3] Booking Completed -> MUST NOT SHOW (Purged completely)
  // --------------------------------------------------------------------------
  console.log("\n--- [3] Booking Completed (or Cleared) ---");

  clearLastSearch();
  const searchAfterBooking = getLastSearch();
  assert.equal(searchAfterBooking, null, "Last search must be null after booking completes");

  const shouldShowAfterBooking = shouldShowContinueSearching(searchAfterBooking);
  assert.equal(
    shouldShowAfterBooking,
    false,
    "Continue searching bar MUST NOT show once user completes a booking"
  );
  console.log("  ✓ After booking is completed, search is purged and bar is hidden (shouldShow = false)");

  // --------------------------------------------------------------------------
  // [4] Codebase Integration Audit
  // --------------------------------------------------------------------------
  console.log("\n--- [4] Codebase Integration Audit ---");

  const homeViewSrc = fs.readFileSync(path.join(process.cwd(), "components/home/home-view.tsx"), "utf-8");
  assert(homeViewSrc.includes("shouldShowContinueSearching"), "home-view.tsx must check shouldShowContinueSearching");
  assert(homeViewSrc.includes("showContinueSearchingBar"), "home-view.tsx must gate bar on showContinueSearchingBar state");

  const detailClientSrc = fs.readFileSync(path.join(process.cwd(), "app/listings/[id]/public-listing-detail-client.tsx"), "utf-8");
  assert(detailClientSrc.includes("clearLastSearch"), "public-listing-detail-client.tsx must call clearLastSearch on booking success");

  const continueBarSrc = fs.readFileSync(path.join(process.cwd(), "components/home/continue-searching-bar.tsx"), "utf-8");
  assert(continueBarSrc.includes("markSearchInCurrentSession"), "continue-searching-bar.tsx must call markSearchInCurrentSession on click");

  console.log("  ✓ Full integration confirmed across client-history, home-view, detail client, and continue-searching-bar");

  console.log("\n==================================================================");
  console.log("   ALL SESSION & TAB CLOSE LIFECYCLE TESTS PASSED!               ");
  console.log("==================================================================\n");
}

runSessionLifecycleTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});

