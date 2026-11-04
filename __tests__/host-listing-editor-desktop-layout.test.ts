import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("host listing editor keeps navigation on the desktop left and forms on the right", () => {
  const editor = read("app/(protected)/host/listings/[id]/host-listing-editor-client.tsx");
  const sidebar = read("app/(protected)/host/listings/[id]/components/EditorSidebar.tsx");

  assert.match(editor, /lg:grid-cols-\[340px_minmax\(0,1fr\)\]/);
  assert.match(editor, /lg:order-2 lg:pt-10/);
  assert.match(editor, /lg:-mt-3/);
  assert.match(editor, /lg:h-dvh lg:min-h-0 lg:overflow-hidden/);
  assert.match(editor, /lg:h-full lg:min-h-0 lg:gap-8 lg:overflow-hidden/);
  assert.match(editor, /lg:h-full lg:max-h-full lg:overflow-y-auto lg:overscroll-contain/);
  assert.match(editor, /lg:order-1 lg:min-w-0/);
  assert.match(editor, /window\.history\.pushState/);
  assert.match(editor, /beforeunload/);
  assert.match(sidebar, /lg:sticky lg:top-\[6\.5rem\]/);
  assert.match(sidebar, /lg:border-r/);
  assert.match(sidebar, /lg:h-\[calc\(100dvh-7\.5rem\)\]/);
  assert.match(sidebar, /visible-scrollbar/);
  assert.doesNotMatch(sidebar, /lg:h-\[1850px\]/);
  assert.doesNotMatch(sidebar, /useScrollbarDrag/);
});

test("mobile listing card entry opens the existing editor section menu before a form", () => {
  const listings = read("components/host/host-listings-workspace.tsx");
  const routeWorkspace = read("app/(protected)/host/listings/[id]/listing-editor-route-workspace.tsx");
  const editor = read("app/(protected)/host/listings/[id]/host-listing-editor-client.tsx");

  assert.match(listings, /href=\{`\/host\/listings\/\$\{item\.id\}`\}/);
  assert.match(routeWorkspace, /activeRouteSegment \? slugToSection\(activeRouteSegment\) : undefined/);
  assert.match(editor, /presentation === "host" && !initialSection && window\.matchMedia\("\(max-width: 767px\)"\)\.matches/);
  assert.match(editor, /mobileOpen=\{isMobileSidebarOpen\}/);
});

test("only the Today host workspace mounts the shared footer", () => {
  const today = read("app/(protected)/host/today/page.tsx");
  assert.match(today, /<Footer\s*\/>/);

  [
    "app/(protected)/host/calendar/page.tsx",
    "components/host/host-calendar-skeleton.tsx",
    "components/host/host-listings-workspace.tsx",
    "components/host/host-listings-skeleton.tsx",
    "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx",
    "app/(protected)/host/listings/[id]/components/YourSpaceSkeletons.tsx",
    "app/(protected)/host/messages/page.tsx",
  ].forEach((file) => {
    assert.doesNotMatch(read(file), /<Footer\s*\/>/);
  });
});
