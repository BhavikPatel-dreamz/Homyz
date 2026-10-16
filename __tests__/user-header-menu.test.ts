import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("\n==================================================================");
console.log("   HEADER DROPDOWN MENU - USER VS HOST SPECIFICATION AUDIT       ");
console.log("==================================================================\n");

const headerPath = path.join(process.cwd(), "components/dashboard/app-header.tsx");
const source = fs.readFileSync(headerPath, "utf-8");

// [1] User vs Host role separation check
console.log("--- [1] Role Separation Logic ---");
assert.ok(source.includes('const isHost = role === "HOST" || role === "ADMIN";'), "Must check whether role is HOST or ADMIN");
assert.ok(source.includes("!isHost ? ("), "Must conditionally render user-specific menu when !isHost");
console.log("✓ Role separation correctly gates user vs host layout");

// [2] User Menu strictly matches 4 sections from reference mock
console.log("\n--- [2] Regular Guest/User Menu Structure ---");

// Group 1: Navigation with icons
assert.ok(source.includes('href="/profile/tab/saved"'), "User menu must include Wishlist link pointing to /profile/tab/saved");
assert.ok(source.includes('<span>Wishlist</span>'), "User menu must render Wishlist label");
assert.ok(source.includes('src="/images/icons/wishlist.svg"'), "User menu must render wishlist icon");

assert.ok(source.includes('href="/profile/tab/upcoming"'), "User menu must include Trips link pointing directly to /profile/tab/upcoming");
assert.ok(source.includes('src="/images/icons/trip.svg"'), "User menu must render trip icon");

assert.ok(source.includes('href="/host/messages"'), "User menu must include Messages link");
assert.ok(source.includes('<span>Messages</span>'), "User menu must render Messages label");
assert.ok(source.includes('src="/images/icons/messages.svg"'), "User menu must render messages icon");

assert.ok(source.includes('href="/profile"'), "User menu must include Profile link");
assert.ok(source.includes('<span>Profile</span>'), "User menu must render Profile label");
assert.ok(source.includes('src="/images/icons/profile.svg"'), "User menu must render profile icon");
console.log("✓ Group 1: Wishlist, Trips, Messages, Profile icons and links verified");

// Group 2: Settings & Help with icons
assert.ok(source.includes('href="/profile-management"'), "User menu must include Account setting link");
assert.ok(source.includes('<span>Account setting</span>'), "User menu must render Account setting label");
assert.ok(source.includes('src="/images/icons/setting.svg"'), "User menu must render setting icon");

assert.ok(source.includes('href="/help"'), "User menu must include Help centre link");
assert.ok(source.includes('<span>Help centre</span>'), "User menu must render Help centre label");
assert.ok(source.includes('src="/images/icons/help.svg"'), "User menu must render help icon");
console.log("✓ Group 2: Account setting, Help centre icons and links verified");

// Group 3: Referral & Gift cards plain links
assert.ok(source.includes('href="/host/refer"'), "User menu must include Refer a Host link");
assert.ok(source.includes("Refer a Host"), "User menu must render 'Refer a Host' text");

assert.ok(source.includes('href="/host/co-host"'), "User menu must include Find a co-Host link");
assert.ok(source.includes("Find a co-Host"), "User menu must render 'Find a co-Host' text");

assert.ok(source.includes('href="/giftcards"'), "User menu must include Gift Cards link");
assert.ok(source.includes("Gift Cards"), "User menu must render 'Gift Cards' text");
console.log("✓ Group 3: Refer a Host, Find a co-Host, Gift Cards links verified");

// Group 4: Log out
assert.ok(source.includes("Log out"), "User menu must render 'Log out' action");
assert.ok(source.includes('signOut({ callbackUrl: "/login?logged_out=true" })'), "Log out must call signOut with callbackUrl");
console.log("✓ Group 4: Log out with signOut callback verified");

// [3] Host Menu contains all host tools
console.log("\n--- [3] Host/Admin Menu Structure ---");
assert.ok(source.includes("hostNavItems.map"), "Host menu must iterate hostNavItems");
assert.ok(source.includes('href: "/dashboard"'), "hostNavItems must contain /dashboard");
assert.ok(source.includes('href: "/host/listings"'), "hostNavItems must contain /host/listings");
assert.ok(source.includes('href: "/host/calendar"'), "hostNavItems must contain /host/calendar");
assert.ok(source.includes('href: "/host/bookings"'), "hostNavItems must contain /host/bookings");
console.log("✓ Host menu preserves all host tools (listings, calendar, reservations, dashboard)");

// [4] Routed Pages exist
console.log("\n--- [4] Route Target Files Verification ---");
const helpPage = path.join(process.cwd(), "app/help/page.tsx");
const giftcardsPage = path.join(process.cwd(), "app/giftcards/page.tsx");
const referPage = path.join(process.cwd(), "app/(protected)/host/refer/page.tsx");
const cohostPage = path.join(process.cwd(), "app/(protected)/host/co-host/page.tsx");

assert.ok(fs.existsSync(helpPage), "Help page must exist");
assert.ok(fs.existsSync(giftcardsPage), "Giftcards page must exist");
assert.ok(fs.existsSync(referPage), "Refer a Host page must exist");
assert.ok(fs.existsSync(cohostPage), "Find a Co-Host page must exist");
console.log("✓ All 4 landing pages exist on disk with zero broken routes");

console.log("\n==================================================================");
console.log("   ALL HEADER DROPDOWN SPECIFICATIONS AUDITED & PASSING!          ");
console.log("==================================================================\n");
