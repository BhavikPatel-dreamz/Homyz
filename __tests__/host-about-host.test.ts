import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Host Listing Editor: read-only Airbnb-style About Host profile", () => {
  const hostViewPath = path.join(
    process.cwd(),
    "app/(protected)/host/listings/[id]/components/HostAboutHostView.tsx",
  );
  const hostViewCode = fs.readFileSync(hostViewPath, "utf8");
  const editorPath = path.join(
    process.cwd(),
    "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx",
  );
  const editorCode = fs.readFileSync(editorPath, "utf8");

  assert(hostViewCode.includes("About the host"));
  assert(hostViewCode.includes("Ask {hostName} about"));
  assert(hostViewCode.includes("{hostName}&apos;s listings"));
  assert(hostViewCode.includes("getInitials"));
  assert(hostViewCode.includes("formatTenure"));
  assert(hostViewCode.includes("listingPreview"));
  assert(!hostViewCode.includes("WhereIveBeenSelector"));
  assert(!hostViewCode.includes("TravelStampGraphic"));
  assert(!hostViewCode.includes("Save profile"));
  assert(!hostViewCode.includes("host-biography"));
  assert(!hostViewCode.includes("updateHostPublicProfileAction"));
  assert(editorCode.includes("hostListingPreview={{"));
});
