import assert from "node:assert/strict";
import {
  canonicalPropertyType,
  canonicalListingType,
  propertyTypeLabel,
  listingTypeLabel,
  normalizeAccessibilityFeature,
  normalizeMostLikeSelection,
} from "../lib/constants/listing-enums";
import { normalizeAmenityId } from "../lib/constants/amenities";

const propertyType = canonicalPropertyType("Villa");
assert.equal(propertyType, "VILLA");
assert.equal(propertyTypeLabel("VILLA"), "Villa");
assert.equal(normalizeMostLikeSelection("HOUSE"), "HOUSE");
assert.equal(normalizeMostLikeSelection("VILLA"), "HOUSE");
assert.equal(normalizeMostLikeSelection("APARTMENT"), "APARTMENT");
assert.equal(normalizeMostLikeSelection("SECONDARY_UNIT"), "SECONDARY_UNIT");
assert.equal(canonicalListingType("Private room"), "ROOM");
assert.equal(listingTypeLabel("ENTIRE_PLACE"), "Entire place");
assert.equal(normalizeAmenityId("Wifi"), "wifi");
assert.equal(normalizeAmenityId("Air conditioning"), "air_conditioning");
assert.equal(normalizeAccessibilityFeature("Step-free access"), "step_free_access");
assert.equal(normalizeAccessibilityFeature("Accessible parking spot"), "accessible_parking");

console.log("E1 foundation mapping tests passed");
