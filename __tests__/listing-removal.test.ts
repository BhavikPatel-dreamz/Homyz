import fs from "fs";
import path from "path";
import {
  LISTING_REMOVAL_SURVEY,
  removeListingInputSchema,
} from "../lib/validation/listing-removal";

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(` ✅ PASS: ${message}`);
}

console.log("\n==================================================================");
console.log("   LISTING REMOVAL & EXIT SURVEY COMPREHENSIVE VERIFICATION     ");
console.log("==================================================================\n");

// -----------------------------------------------------------------------------
// [1] Survey Categories & Options Exact Match with Airbnb Reference
// -----------------------------------------------------------------------------
console.log("--- [1] Survey Categories & Options Reference Integrity ---");

assert(LISTING_REMOVAL_SURVEY.length === 6, "Must contain exactly 6 main categories matching reference");

const cat1 = LISTING_REMOVAL_SURVEY.find((c) => c.id === "no_longer_able");
assert(Boolean(cat1), "Category 'no_longer_able' must exist");
assert(cat1?.title === "I'm no longer able to host.", "Category 1 title must match");
assert(cat1?.options.some((o) => o.label === "I don't currently have a property to list."), "Cat 1: no property option");
assert(cat1?.options.some((o) => o.label === "Legally, I'm no longer able to host."), "Cat 1: legally unable option");
assert(cat1?.options.some((o) => o.label === "My neighbours have made it hard for me to host."), "Cat 1: neighbours option");
assert(cat1?.options.some((o) => o.label === "Hosting no longer fits my lifestyle."), "Cat 1: lifestyle option");
assert(cat1?.options.some((o) => o.label === "Another reason"), "Cat 1: another reason option");

const cat2 = LISTING_REMOVAL_SURVEY.find((c) => c.id === "not_ready");
assert(Boolean(cat2), "Category 'not_ready' must exist");
assert(cat2?.title === "I'm not ready to host right now.", "Category 2 title must match");
assert(cat2?.options.some((o) => o.label === "I only host occasionally."), "Cat 2: occasionally option");
assert(cat2?.options.some((o) => o.label === "I've created my listing but need to get my property ready to host guests."), "Cat 2: ready property option");
assert(cat2?.options.some((o) => o.label === "I'm renovating my place or making improvements."), "Cat 2: renovating option");

const cat3 = LISTING_REMOVAL_SURVEY.find((c) => c.id === "expected_more_platform");
assert(Boolean(cat3), "Category 'expected_more_platform' must exist");
assert(cat3?.options.some((o) => o.label.includes("customer support")), "Cat 3: customer support option");
assert(cat3?.options.some((o) => o.label.includes("trust")), "Cat 3: trust option");
assert(cat3?.options.some((o) => o.label.includes("supportive resources")), "Cat 3: resources option");
assert(cat3?.options.some((o) => o.label.includes("improve its policies")), "Cat 3: policies option");

const cat4 = LISTING_REMOVAL_SURVEY.find((c) => c.id === "make_more_money");
assert(Boolean(cat4), "Category 'make_more_money' must exist");
assert(cat4?.title === "I was hoping to make more money.", "Category 4 title must match");
assert(cat4?.options.some((o) => o.label === "Managing the property was more work than I anticipated."), "Cat 4: more work option");
assert(cat4?.options.some((o) => o.label === "Dealing with taxes was too much work."), "Cat 4: taxes option");
assert(cat4?.options.some((o) => o.label === "The local registration process was too much work."), "Cat 4: registration option");
assert(cat4?.options.some((o) => o.label === "I hoped to get more bookings."), "Cat 4: more bookings option");
assert(cat4?.options.some((o) => o.label === "I expected to make more money."), "Cat 4: more money option");

const cat5 = LISTING_REMOVAL_SURVEY.find((c) => c.id === "smoothly_with_guests");
assert(Boolean(cat5), "Category 'smoothly_with_guests' must exist");
assert(cat5?.title === "I expected things to go more smoothly with guests.", "Category 5 title must match");
assert(cat5?.options.some((o) => o.label === "Guests didn't follow my house rules."), "Cat 5: house rules option");
assert(cat5?.options.some((o) => o.label === "Guests stole or damaged my property."), "Cat 5: damage option");
assert(cat5?.options.some((o) => o.label === "Guests cancelled their reservations too often."), "Cat 5: cancellations option");
assert(cat5?.options.some((o) => o.label === "Guests were rude or demanding."), "Cat 5: rude guests option");
assert(cat5?.options.some((o) => o.label === "Guests left unfair reviews."), "Cat 5: unfair reviews option");

const cat6 = LISTING_REMOVAL_SURVEY.find((c) => c.id === "duplicate_listing");
assert(Boolean(cat6), "Category 'duplicate_listing' must exist");
assert(cat6?.title === "This is a duplicate listing.", "Category 6 title must match");
assert(cat6?.options.some((o) => o.label === "This is a duplicate listing."), "Cat 6: duplicate option");

// -----------------------------------------------------------------------------
// [2] Validation Schemas
// -----------------------------------------------------------------------------
console.log("\n--- [2] Input Validation Schemas ---");

// Valid payload
const validResult = removeListingInputSchema.safeParse({
  listingId: "list_123",
  categories: ["I'm no longer able to host."],
  reasons: ["I don't currently have a property to list."],
  customFeedback: "Relocating to another city.",
});
assert(validResult.success, "Valid survey payload must pass validation");

// Invalid payload: empty reasons
const emptyReasonsResult = removeListingInputSchema.safeParse({
  listingId: "list_123",
  categories: ["I'm no longer able to host."],
  reasons: [],
});
assert(!emptyReasonsResult.success, "Empty reasons list must be rejected");

// Invalid payload: missing listingId
const missingListingResult = removeListingInputSchema.safeParse({
  listingId: "",
  categories: ["I'm no longer able to host."],
  reasons: ["I don't currently have a property to list."],
});
assert(!missingListingResult.success, "Empty listingId must be rejected");

// -----------------------------------------------------------------------------
// [3] Component Architecture & AGENTS.md Scroll Lock Compliance
// -----------------------------------------------------------------------------
console.log("\n--- [3] Component Architecture & ModalOverlay Scroll-Lock Compliance ---");

const removeModalPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/RemoveListingModal.tsx"
);
assert(fs.existsSync(removeModalPath), "RemoveListingModal.tsx must exist");
const removeModalCode = fs.readFileSync(removeModalPath, "utf-8");

assert(
  removeModalCode.includes('import { ModalOverlay } from "@/components/ui/modal-overlay";'),
  "RemoveListingModal must import ModalOverlay"
);
assert(
  removeModalCode.includes("<ModalOverlay"),
  "RemoveListingModal must use <ModalOverlay as the outer wrapper"
);
assert(
  !removeModalCode.includes("document.body.style.overflow"),
  "RemoveListingModal must NOT directly mutate document.body.style.overflow"
);
assert(
  !removeModalCode.includes("document.documentElement.style.overflow"),
  "RemoveListingModal must NOT directly mutate document.documentElement.style.overflow"
);

assert(
  removeModalCode.includes("Let us know why you've changed your mind about hosting") ||
  removeModalCode.includes("Let us know why you&apos;ve changed your mind about hosting"),
  "RemoveListingModal must display the exact heading"
);
assert(
  removeModalCode.includes("Choose all that apply"),
  "RemoveListingModal must display 'Choose all that apply'"
);
assert(
  removeModalCode.includes("Permanently remove this listing?"),
  "RemoveListingModal must have step 2 confirmation"
);

// -----------------------------------------------------------------------------
// [4] Editor Sidebar & Client Integration
// -----------------------------------------------------------------------------
console.log("\n--- [4] Host Listing Editor & Sidebar Integration ---");

const editorSidebarPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/EditorSidebar.tsx"
);
const editorSidebarCode = fs.readFileSync(editorSidebarPath, "utf-8");
assert(
  editorSidebarCode.includes("setIsRemoveListingModalOpen"),
  "EditorSidebar must accept and invoke setIsRemoveListingModalOpen"
);

const hostEditorPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"
);
const hostEditorCode = fs.readFileSync(hostEditorPath, "utf-8");
assert(
  hostEditorCode.includes("RemoveListingModal"),
  "host-listing-editor-client.tsx must import and mount RemoveListingModal"
);
assert(
  hostEditorCode.includes("isRemoveListingModalOpen"),
  "host-listing-editor-client.tsx must maintain isRemoveListingModalOpen state"
);

// -----------------------------------------------------------------------------
// [5] Database & Service Layer Storage
// -----------------------------------------------------------------------------
console.log("\n--- [5] Database & Service Layer Persistence ---");

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
const schemaCode = fs.readFileSync(schemaPath, "utf-8");
assert(
  schemaCode.includes("model ListingRemovalFeedback"),
  "schema.prisma must include ListingRemovalFeedback model"
);
assert(
  schemaCode.includes("listingRemovalFeedbacks"),
  "schema.prisma must include reverse relation on User"
);

const listingServicePath = path.resolve(__dirname, "../services/listing.service.ts");
const listingServiceCode = fs.readFileSync(listingServicePath, "utf-8");
assert(
  listingServiceCode.includes("prisma.listingRemovalFeedback.create"),
  "listingService.remove must insert into listingRemovalFeedback"
);

const migrationPath = path.resolve(
  __dirname,
  "../prisma/migrations/20260909140000_listing_removal_feedback/migration.sql"
);
assert(fs.existsSync(migrationPath), "Migration SQL file must exist");

const apiRoutePath = path.resolve(
  __dirname,
  "../app/api/v1/listings/[id]/remove/route.ts"
);
assert(fs.existsSync(apiRoutePath), "REST API route /api/v1/listings/[id]/remove/route.ts must exist");

console.log("\n==================================================================");
console.log("   🎉 ALL LISTING REMOVAL VERIFICATION TESTS PASSED (100%)!       ");
console.log("==================================================================\n");
