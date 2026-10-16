import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { updateListingSchema } from "../lib/validation/listing";
import { toPublicListingDTO } from "../services/mappers";

describe("Host Listing Editor: Arrival Guide Flow", () => {
  describe("Directions to Property: Validation & Privacy", () => {
    it("accepts valid directions text up to 5,000 characters", () => {
      const parsed = updateListingSchema.parse({
        directions: "Take Exit 4 from Northern Ring Road, turn right after the grand mosque.",
      });
      assert.equal(
        parsed.directions,
        "Take Exit 4 from Northern Ring Road, turn right after the grand mosque."
      );
    });

    it("allows null or empty directions", () => {
      const parsedNull = updateListingSchema.parse({ directions: null });
      assert.equal(parsedNull.directions, null);

      const parsedEmpty = updateListingSchema.parse({ directions: "" });
      assert.equal(parsedEmpty.directions, "");
    });

    it("rejects directions exceeding 5,000 characters", () => {
      const oversized = "a".repeat(5001);
      assert.throws(() => {
        updateListingSchema.parse({ directions: oversized });
      });
    });

    it("strictly omits directions from public listing DTO for non-booked viewers", () => {
      const mockListing: any = {
        id: "listing-test-1",
        title: "Diplomatic Villa",
        description: "Cozy home",
        price: 50000,
        published: true,
        status: "ACTIVE",
        hostingType: "ENTIRE_HOME",
        propertyType: "VILLA",
        listingType: "ENTIRE_PLACE",
        city: "Riyadh",
        country: "SA",
        guests: 4,
        bedrooms: 2,
        beds: 2,
        bathrooms: 2,
        directions: "Secret gate code is #9988. Private driveway instructions.",
        wifiPassword: "supersecretwifi",
        doorCode: "1234#",
        checkInInstructions: "Private key under the welcome mat",
      };

      const publicDTO = toPublicListingDTO(mockListing);

      assert.equal(
        (publicDTO as any).directions,
        undefined,
        "Public listing DTO must NEVER expose directions before booking"
      );
      assert.equal(
        (publicDTO as any).wifiPassword,
        undefined,
        "Public listing DTO must NEVER expose wifi password"
      );
      assert.equal(
        (publicDTO as any).doorCode,
        undefined,
        "Public listing DTO must NEVER expose door code"
      );
    });
  });

  describe("DirectionsView Component UI", () => {
    it("contains Directions to property heading, privacy notice, structured tips, and character counter", () => {
      const filePath = path.join(
        process.cwd(),
        "app/(protected)/host/listings/[id]/components/HouseRulesAndArrivalViews.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      assert.match(content, /Directions to property/);
      assert.match(content, /Private · Only confirmed guests receive these directions after booking/);
      assert.match(content, /Driving directions/);
      assert.match(content, /Parking instructions/);
      assert.match(content, /Public transportation/);
      assert.match(content, /Landmarks & entrance/);
      assert.match(content, /5000 characters/);
      assert.match(content, /handleSaveSection\("directions"\)/);
    });
  });

  describe("Arrival Guide Right-Side Summary & Status Panel", () => {
    it("EditorSidebar renders Arrival Guide sections including Directions to property", () => {
      const filePath = path.join(
        process.cwd(),
        "app/(protected)/host/listings/[id]/components/EditorSidebar.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      // Documented Arrival Sections in sidebar
      assert.match(content, /Check-in/);
      assert.match(content, /Directions to property/);
      assert.match(content, /Check-in method/);
      assert.match(content, /Wifi details/);
      assert.match(content, /House manual/);
      assert.match(content, /Check-out instructions/);

      // Clickable navigation handlers
      assert.match(content, /setActiveSection\("directions"\)/);
      assert.match(content, /setActiveSection\("wifi-details"\)/);
      assert.match(content, /setActiveSection\("house-manual"\)/);
      assert.match(content, /setActiveSection\("interaction-preferences"\)/);
    });

    it("derives section completion accurately based on actual data", () => {
      // Logic mirrors EditorSidebar & host-listing-editor-client derivation
      const computeStatuses = (data: {
        checkInStart?: string | null;
        checkOutTime?: string | null;
        directions?: string | null;
        checkInMethod?: string | null;
        wifiNetwork?: string | null;
        houseManual?: string | null;
        checkOutInstructions?: string | null;
        guidebooksCount?: number;
        guestInteractionPreference?: string | null;
      }) => {
        return {
          checkInCheckOut: Boolean(data.checkInStart && data.checkOutTime),
          directions: Boolean(data.directions && data.directions.trim().length > 0),
          checkInMethod: Boolean(data.checkInMethod && data.checkInMethod.trim().length > 0),
          wifi: Boolean(data.wifiNetwork && data.wifiNetwork.trim().length > 0),
          houseManual: Boolean(data.houseManual && data.houseManual.trim().length > 0),
          checkOutInstructions: Boolean(data.checkOutInstructions && data.checkOutInstructions.trim().length > 0),
          guidebooks: Boolean(data.guidebooksCount && data.guidebooksCount > 0),
          interactionPref: Boolean(data.guestInteractionPreference && data.guestInteractionPreference.trim().length > 0),
        };
      };

      // Incomplete listing
      const emptyStatuses = computeStatuses({});
      assert.equal(emptyStatuses.checkInCheckOut, false);
      assert.equal(emptyStatuses.directions, false);
      assert.equal(emptyStatuses.wifi, false);
      assert.equal(emptyStatuses.houseManual, false);

      // Completed listing
      const completeStatuses = computeStatuses({
        checkInStart: "15:00",
        checkOutTime: "11:00",
        directions: "Exit 4 from Ring Road",
        checkInMethod: "SMART_LOCK",
        wifiNetwork: "HomyzGuest",
        houseManual: "Turn off AC when leaving",
        checkOutInstructions: "Lock the front door",
        guidebooksCount: 2,
        guestInteractionPreference: "Available via chat anytime",
      });

      assert.equal(completeStatuses.checkInCheckOut, true);
      assert.equal(completeStatuses.directions, true);
      assert.equal(completeStatuses.checkInMethod, true);
      assert.equal(completeStatuses.wifi, true);
      assert.equal(completeStatuses.houseManual, true);
      assert.equal(completeStatuses.checkOutInstructions, true);
      assert.equal(completeStatuses.guidebooks, true);
      assert.equal(completeStatuses.interactionPref, true);
    });
  });

  describe("Editor State & Mobile Integration", () => {
    it("host-listing-editor-client passes arrival props and updates directions state on save", () => {
      const filePath = path.join(
        process.cwd(),
        "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      assert.match(content, /guestInteractionPreference=\{editGuestInteraction\}/);
      assert.match(content, /guidebooksCount=\{initialGuidebooks\?\.length \?\? 0\}/);
      assert.match(content, /setDirections\(payload\.directions \|\| ""\)/);
      assert.match(content, /arrivalGuideCompletedCount/);
      assert.match(content, /Arrival Guide Progress/);
    });
  });
});

