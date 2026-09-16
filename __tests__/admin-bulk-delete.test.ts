import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("\n==================================================================");
console.log("   ADMIN MULTIPLE PROPERTY DELETE VERIFICATION SUITE              ");
console.log("==================================================================\n");

// --- [1] Server Action Audit ---
console.log("--- [1] Server Action Audit ---");
const actionsPath = path.resolve(__dirname, "../actions/admin/listingActions.ts");
assert(fs.existsSync(actionsPath), "actions/admin/listingActions.ts must exist");
const actionsCode = fs.readFileSync(actionsPath, "utf-8");

assert(
  actionsCode.includes("export async function adminBulkDeleteListingsAction"),
  "adminBulkDeleteListingsAction must be exported from actions/admin/listingActions.ts"
);
assert(
  actionsCode.includes("PERMISSIONS.LISTINGS_DELETE"),
  "adminBulkDeleteListingsAction must enforce LISTINGS_DELETE permission"
);
assert(
  actionsCode.includes("listingService.permanentDeleteForAdmin(actor, id)"),
  "adminBulkDeleteListingsAction must call listingService.permanentDeleteForAdmin for permanent hard deletion"
);
assert(
  actionsCode.includes("listingService.permanentDeleteForAdmin(actor, input.listingId)"),
  "adminDeleteListingAction must call listingService.permanentDeleteForAdmin for single permanent hard deletion"
);
assert(
  actionsCode.includes("deletedIds") && actionsCode.includes("failedIds"),
  "adminBulkDeleteListingsAction must return both deletedIds and failedIds"
);
assert(
  actionsCode.includes('revalidatePath("/admin/listings")'),
  "adminBulkDeleteListingsAction must revalidate /admin/listings"
);
console.log("✓ adminBulkDeleteListingsAction and adminDeleteListingAction server actions verified!");

// --- [1.5] Listing Service Hard Delete Audit ---
console.log("\n--- [1.5] Listing Service Hard Delete Audit ---");
const servicePath = path.resolve(__dirname, "../services/listing.service.ts");
assert(fs.existsSync(servicePath), "services/listing.service.ts must exist");
const serviceCode = fs.readFileSync(servicePath, "utf-8");

assert(
  serviceCode.includes("async function permanentDeleteForAdmin"),
  "listing.service.ts must implement permanentDeleteForAdmin"
);
assert(
  serviceCode.includes("tx.listing.delete"),
  "permanentDeleteForAdmin must completely hard delete the listing from the database"
);
assert(
  serviceCode.includes("tx.booking.deleteMany"),
  "permanentDeleteForAdmin must cascade delete associated bookings"
);
assert(
  serviceCode.includes("tx.reservationTax.deleteMany"),
  "permanentDeleteForAdmin must cascade delete associated reservation taxes"
);
assert(
  serviceCode.includes("listForAdminDashboard") && serviceCode.includes("where: { deletedAt: null }"),
  "listForAdminDashboard must exclude deleted listings"
);
console.log("✓ listingService.permanentDeleteForAdmin and listForAdminDashboard filtering verified!");


// --- [2] UI Multi-Selection State & Handlers Audit ---
console.log("\n--- [2] UI Multi-Selection State & Handlers Audit ---");
const clientPath = path.resolve(__dirname, "../app/(protected)/admin/listings/admin-listings-client.tsx");
assert(fs.existsSync(clientPath), "admin-listings-client.tsx must exist");
const clientCode = fs.readFileSync(clientPath, "utf-8");

assert(
  clientCode.includes("adminBulkDeleteListingsAction"),
  "admin-listings-client must import and call adminBulkDeleteListingsAction"
);
assert(
  clientCode.includes("selectedListingIds") && clientCode.includes("setSelectedListingIds"),
  "admin-listings-client must manage selectedListingIds state"
);
assert(
  clientCode.includes("toggleSelectAllOnPage"),
  "admin-listings-client must have toggleSelectAllOnPage handler"
);
assert(
  clientCode.includes("toggleSelectListing"),
  "admin-listings-client must have toggleSelectListing handler"
);
assert(
  clientCode.includes("handleBulkDelete"),
  "admin-listings-client must have handleBulkDelete handler"
);
console.log("✓ Multi-selection state and action handlers verified!");


// --- [3] UI Elements: Toolbar, Checkboxes, & Modals ---
console.log("\n--- [3] UI Elements: Toolbar, Checkboxes, & Modals ---");

// Bulk actions toolbar
assert(
  clientCode.includes("selectedListingIds.length > 0") && clientCode.includes("Delete Selected"),
  "Must render bulk actions bar with 'Delete Selected' when items are selected"
);
assert(
  clientCode.includes("Clear selection"),
  "Must include 'Clear selection' action button in toolbar"
);

// Table Header select-all
assert(
  clientCode.includes("allOnPageSelected"),
  "Table header must bind select-all checkbox to allOnPageSelected"
);
assert(
  clientCode.includes("indeterminate"),
  "Table header must support indeterminate checkbox state for partial selection"
);

// Row Checkboxes with stopPropagation
assert(
  clientCode.includes('onClick={(e) => e.stopPropagation()}') &&
  clientCode.includes('onChange={() => toggleSelectListing(item.id)}'),
  "Row checkbox click must stopPropagation to prevent opening listing details"
);

// Mobile Card Checkboxes
assert(
  clientCode.includes('aria-label={`Select property ${item.title}`}') &&
  clientCode.includes('onClick={(e) => e.stopPropagation()}'),
  "Mobile cards must also render selection checkboxes with stopPropagation"
);

// Bulk Delete Confirmation Modal
assert(
  clientCode.includes("showBulkDeleteModal") && clientCode.includes("Permanently Delete"),
  "Must render Bulk Delete Confirmation Modal"
);
assert(
  clientCode.includes("bookingCount > 0"),
  "Bulk delete modal must check and warn about properties with active/confirmed bookings"
);
assert(
  clientCode.includes("toast.success") && clientCode.includes("toast.error"),
  "Must notify admin via toast on bulk delete results"
);
console.log("✓ Checkboxes, bulk toolbar, mobile view, and confirmation modal verified!");

console.log("\n==================================================================");
console.log("   ALL ADMIN MULTIPLE PROPERTY DELETE TESTS PASSED!               ");
console.log("==================================================================\n");

