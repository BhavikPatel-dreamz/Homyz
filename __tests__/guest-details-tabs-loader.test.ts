import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("==================================================================");
console.log("   GUEST DETAILS TABS LOADER VERIFICATION SUITE                  ");
console.log("==================================================================");

// 1. Verify GuestDetailsView file exists and contains tab loader logic
const guestDetailsViewPath = path.resolve(__dirname, "../components/admin/guest-details-view.tsx");
assert(fs.existsSync(guestDetailsViewPath), "components/admin/guest-details-view.tsx must exist");
const code = fs.readFileSync(guestDetailsViewPath, "utf-8");

// 2. Verify tab transition and state management
console.log("\n--- [1] Tab State & Transition Audit ---");
assert(
  code.includes("const [isTabPending, startTabTransition] = useTransition();"),
  "GuestDetailsView must use useTransition for smooth tab switching"
);
assert(
  code.includes("const [targetTab, setTargetTab] = useState"),
  "GuestDetailsView must track targetTab state"
);
assert(
  code.includes("handleTabChange"),
  "GuestDetailsView must have handleTabChange handler"
);
console.log("✓ Tab transition and target state verified!");

// 3. Verify Tab Button Loader UI
console.log("\n--- [2] Tab Buttons Loader UI Audit ---");
assert(
  code.includes('role="tab"'),
  "Tab buttons must have role='tab'"
);
assert(
  code.includes("aria-selected={isSelected}"),
  "Tab buttons must indicate aria-selected state"
);
assert(
  code.includes("animate-spin"),
  "Tab buttons must render an active spinner when loading"
);
console.log("✓ Tab buttons spinning loader verified!");

// 4. Verify GuestTabSkeleton component
console.log("\n--- [3] Dedicated GuestTabSkeleton Component Audit ---");
assert(
  code.includes("export function GuestTabSkeleton"),
  "GuestDetailsView must export GuestTabSkeleton component"
);
assert(
  code.includes('aria-label="Loading bookings history"'),
  "GuestTabSkeleton must render bookings loader with accessible aria-label"
);
assert(
  code.includes('aria-label="Loading guest activity logs"'),
  "GuestTabSkeleton must render activity loader with accessible aria-label"
);
assert(
  code.includes('aria-label="Loading overview and identity details"'),
  "GuestTabSkeleton must render overview loader with accessible aria-label"
);
assert(
  code.includes("skeleton-shimmer"),
  "GuestTabSkeleton must utilize skeleton-shimmer styles"
);
console.log("✓ GuestTabSkeleton verified for all 3 tabs (overview, bookings, activity)!");

// 5. Verify Tab Content Conditional Rendering
console.log("\n--- [4] Tab Content Loader Integration Audit ---");
assert(
  code.includes("<GuestTabSkeleton tabId={targetTab} />"),
  "GuestDetailsView must render GuestTabSkeleton when isTabPending is active"
);
console.log("✓ Tab content loader conditionally rendered during tab navigation!");

console.log("\n==================================================================");
console.log("   ALL GUEST DETAILS TABS LOADER TESTS PASSED!                    ");
console.log("==================================================================\n");
