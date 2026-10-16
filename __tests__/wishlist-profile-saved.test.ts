import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { normalizeTabId, getProfileTabHref } from "../lib/profile/tab-utils";

console.log("\n==================================================================");
console.log("   WISHLIST -> /profile/tab/saved INTEGRATION & AUDIT TEST       ");
console.log("==================================================================\n");

// [1] tab-utils normalization and aliases
console.log("--- [1] Tab Normalization & Aliases ---");
assert.strictEqual(normalizeTabId("saved"), "saved");
assert.strictEqual(normalizeTabId("wishlist"), "saved");
assert.strictEqual(normalizeTabId("wishlists"), "saved");
assert.strictEqual(getProfileTabHref("saved"), "/profile/tab/saved");
assert.strictEqual(getProfileTabHref("wishlist"), "/profile/tab/saved");
console.log("✓ 'saved', 'wishlist', and 'wishlists' all normalize to '/profile/tab/saved'");

// [2] /wishlists page redirect
console.log("\n--- [2] /wishlists Route Redirect ---");
const wishlistsPage = path.join(process.cwd(), "app/wishlists/page.tsx");
const wishlistsSource = fs.readFileSync(wishlistsPage, "utf-8");
assert.ok(wishlistsSource.includes('redirect("/profile/tab/saved")'), "app/wishlists/page.tsx must redirect to /profile/tab/saved");
console.log("✓ /wishlists redirects directly to /profile/tab/saved");

// [3] Header links point to /profile/tab/saved
console.log("\n--- [3] Header Links ---");
const headerPage = path.join(process.cwd(), "components/dashboard/app-header.tsx");
const headerSource = fs.readFileSync(headerPage, "utf-8");
assert.ok(headerSource.includes('href="/profile/tab/saved"'), "app-header must link Wishlist to /profile/tab/saved");
assert.ok(!headerSource.includes('href="/wishlists"'), "app-header must not contain old /wishlists link");

const mainHeaderPage = path.join(process.cwd(), "components/home/main-header.tsx");
const mainHeaderSource = fs.readFileSync(mainHeaderPage, "utf-8");
assert.ok(mainHeaderSource.includes('href="/profile/tab/saved"'), "main-header must link Wishlist to /profile/tab/saved");
assert.ok(!mainHeaderSource.includes('href="/wishlists"'), "main-header must not contain old /wishlists link");
console.log("✓ All header links now point directly to /profile/tab/saved");

// [4] Server-side favorites loader includes initialFavorites
console.log("\n--- [4] Server-side Favorites Loader ---");
const loaderPage = path.join(process.cwd(), "lib/profile/profile-loader.ts");
const loaderSource = fs.readFileSync(loaderPage, "utf-8");
assert.ok(loaderSource.includes("prisma.listingFavorite.findMany"), "profile-loader must query prisma.listingFavorite");
assert.ok(loaderSource.includes("initialFavorites"), "profile-loader must return initialFavorites");
console.log("✓ loadProfilePageData queries and supplies initialFavorites");

// [5] SavedListingsView component utilizes ListingCard and reactive events
console.log("\n--- [5] SavedListingsView Component ---");
const savedViewPage = path.join(process.cwd(), "components/profile/saved-listings-view.tsx");
const savedViewSource = fs.readFileSync(savedViewPage, "utf-8");
assert.ok(savedViewSource.includes("<ListingCard"), "SavedListingsView must render real ListingCard components");
assert.ok(savedViewSource.includes('favoriteVariant="remove"'), "ListingCard must use favoriteVariant='remove' in SavedListingsView");
assert.ok(savedViewSource.includes("homyz:favorite-changed"), "SavedListingsView must listen to homyz:favorite-changed event");
assert.ok(savedViewSource.includes("/api/v1/favorites"), "SavedListingsView must support fetching /api/v1/favorites");
assert.ok(savedViewSource.includes("Your wishlist is empty"), "SavedListingsView must have an empty state");
console.log("✓ SavedListingsView uses ListingCard, listens to reactive events, and displays empty states");

// [6] Favorite mutation route revalidation
console.log("\n--- [6] Favorite Mutation Cache Revalidation ---");
const favRoutePage = path.join(process.cwd(), "app/api/v1/favorites/[listingId]/route.ts");
const favRouteSource = fs.readFileSync(favRoutePage, "utf-8");
assert.ok(favRouteSource.includes('revalidatePath("/profile/tab/saved")'), "Favorite mutations must revalidate /profile/tab/saved");
console.log("✓ /api/v1/favorites/[listingId] revalidates /profile/tab/saved on change");

console.log("\n==================================================================");
console.log("   ALL WISHLIST -> /profile/tab/saved TESTS PASSED!              ");
console.log("==================================================================\n");

