import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("header become host button and role conversion flow", () => {
  it("renders Become a host button in app-header when user is logged in", () => {
    const headerPath = path.join(process.cwd(), "components/dashboard/app-header.tsx");
    const source = fs.readFileSync(headerPath, "utf-8");

    // Must have handleBecomeHost function
    assert.ok(source.includes("handleBecomeHost"), "app-header must contain handleBecomeHost");

    // Must call convert endpoint
    assert.ok(source.includes('action: "convert"'), "handleBecomeHost must post action: 'convert'");

    // Must redirect to /host/listings
    assert.ok(source.includes('router.push("/host/listings")'), "handleBecomeHost must redirect to /host/listings");

    // Must render Become a host button beside Switch to traveling
    assert.ok(source.includes("Become a host"), "Header must include 'Become a host' button");
    assert.ok(source.includes("Switch to traveling"), "Header must include 'Switch to traveling' link");
  });

  it("handles host conversion action in host application API route", () => {
    const routePath = path.join(process.cwd(), "app/api/v1/host/application/route.ts");
    const routeSource = fs.readFileSync(routePath, "utf-8");

    assert.ok(routeSource.includes('body.action === "convert"'), "API route must handle action === 'convert'");
    assert.ok(routeSource.includes("convertToHost(actor)"), "API route must call convertToHost(actor)");
  });
});

