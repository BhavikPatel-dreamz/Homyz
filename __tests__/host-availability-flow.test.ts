import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { updateListingSchema } from "../lib/validation/listing";
import { parseCutoffHour, parseRequiredAdvanceDays } from "../services/booking.service";

describe("Host Listing Availability Flow", () => {
  describe("Schema & Validation", () => {
    it("accepts valid availability configuration", () => {
      const parsed = updateListingSchema.parse({
        minNights: 2,
        maxNights: 30,
        advanceNotice: "At least 2 days",
        sameDayCutoff: "6:00 PM",
        allowSameDayRequests: true,
      });

      assert.equal(parsed.minNights, 2);
      assert.equal(parsed.maxNights, 30);
      assert.equal(parsed.advanceNotice, "At least 2 days");
      assert.equal(parsed.sameDayCutoff, "6:00 PM");
      assert.equal(parsed.allowSameDayRequests, true);
    });

    it("rejects non-positive minimum nights (minNights < 1)", () => {
      assert.throws(
        () => {
          updateListingSchema.parse({
            minNights: 0,
            maxNights: 10,
          });
        },
        (err: any) => {
          return err.issues?.some((issue: any) => issue.path.includes("minNights"));
        }
      );
    });

    it("rejects non-positive maximum nights (maxNights < 1)", () => {
      assert.throws(
        () => {
          updateListingSchema.parse({
            minNights: 1,
            maxNights: 0,
          });
        },
        (err: any) => {
          return err.issues?.some((issue: any) => issue.path.includes("maxNights"));
        }
      );
    });

    it("rejects maximum nights less than minimum nights (maxNights < minNights)", () => {
      assert.throws(
        () => {
          updateListingSchema.parse({
            minNights: 7,
            maxNights: 3,
          });
        },
        (err: any) => {
          return err.issues?.some(
            (issue: any) =>
              issue.path.includes("maxNights") &&
              issue.message.includes("Maximum nights must be at least the minimum nights")
          );
        }
      );
    });

    it("rejects invalid advanceNotice values", () => {
      assert.throws(() => {
        updateListingSchema.parse({
          advanceNotice: "Invalid Notice String" as any,
        });
      });
    });

    it("rejects invalid sameDayCutoff values", () => {
      assert.throws(() => {
        updateListingSchema.parse({
          sameDayCutoff: "4:00 PM" as any,
        });
      });
    });
  });

  describe("Availability Parsing Helpers", () => {
    it("parses cutoff hours accurately", () => {
      assert.equal(parseCutoffHour("6:00 AM"), 6);
      assert.equal(parseCutoffHour("12:00 PM"), 12);
      assert.equal(parseCutoffHour("3:00 PM"), 15);
      assert.equal(parseCutoffHour("6:00 PM"), 18);
      assert.equal(parseCutoffHour("9:00 PM"), 21);
      assert.equal(parseCutoffHour("12:00 AM"), 24);
      assert.equal(parseCutoffHour(undefined), 24);
    });

    it("parses advance notice days accurately", () => {
      assert.equal(parseRequiredAdvanceDays("Same day"), 0);
      assert.equal(parseRequiredAdvanceDays("At least 1 day"), 1);
      assert.equal(parseRequiredAdvanceDays("1 day"), 1);
      assert.equal(parseRequiredAdvanceDays("At least 2 days"), 2);
      assert.equal(parseRequiredAdvanceDays("2 days"), 2);
      assert.equal(parseRequiredAdvanceDays("At least 3 days"), 3);
      assert.equal(parseRequiredAdvanceDays("3 days"), 3);
      assert.equal(parseRequiredAdvanceDays("At least 7 days"), 7);
      assert.equal(parseRequiredAdvanceDays("7 days"), 7);
      assert.equal(parseRequiredAdvanceDays(undefined), 0);
    });
  });

  describe("UI & Component Integration", () => {
    it("PricingAndBookingViews has trip length, range badge, radio cards, and toggle", () => {
      const filePath = path.join(
        process.cwd(),
        "app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      assert.match(content, /Trip length/);
      assert.match(content, /Minimum stay/);
      assert.match(content, /Maximum stay/);
      assert.match(content, /\{minNights\}–\{maxNights\} nights/);
      assert.match(content, /Advance notice/);
      assert.match(content, /Same day/);
      assert.match(content, /At least 1 day/);
      assert.match(content, /Same-day booking requests/);
      assert.match(content, /Same-day cutoff time/);
      assert.match(content, /Maximum stay.*cannot be less than minimum stay/);
    });

    it("EditorSidebar presents synced availability summary", () => {
      const filePath = path.join(
        process.cwd(),
        "app/(protected)/host/listings/[id]/components/EditorSidebar.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      assert.match(content, /\{minNights\}-\{maxNights\} night stays/);
      assert.match(content, /\{advanceNotice\} notice/);
      assert.match(content, /allowSameDayRequests \? `Same-day requests until \$\{sameDayCutoff\}` : "Same-day requests unavailable"/);
    });

    it("CalendarSettingsPanel reads listing minNights and maxNights without duplication", () => {
      const filePath = path.join(
        process.cwd(),
        "components/host/calendar-settings-panel.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      assert.match(content, /\{listing\.minNights\}–\{listing\.maxNights\} nights/);
      assert.match(content, /\/host\/listings\/\$\{listing\.id\}\/availability/);
    });

    it("host-listing-editor-client contains availability save validation and sync", () => {
      const filePath = path.join(
        process.cwd(),
        "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      assert.match(content, /sectionToSave === "availability"/);
      assert.match(content, /Minimum stay must be at least 1 night/);
      assert.match(content, /Maximum stay must be at least 1 night/);
      assert.match(content, /Maximum stay.*cannot be less than minimum stay/);
      assert.match(content, /setMinNights\(payload\.minNights\)/);
      assert.match(content, /setMaxNights\(payload\.maxNights\)/);
    });
  });
});

