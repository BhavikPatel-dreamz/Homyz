import assert from "node:assert/strict";
import { updateListingSchema } from "../lib/validation/listing";

const payload = {
  descriptionSections: {
    property: "Bright and airy apartment with natural light.",
    guestAccess: "Guests can use the main entrance and the rooftop terrace.",
    guestInteraction: "I am available for local recommendations.",
    otherDetails: "Check-in is flexible after 3 pm.",
  },
  neighborhoodDescription: "Quiet residential block near the metro.",
  gettingAround: "The station is a 10-minute walk away.",
  views: ["city_view", "garden_view"],
  amenities: ["wifi", "air_conditioning"],
};

const parsed = updateListingSchema.parse(payload);
assert.deepEqual(parsed.descriptionSections, payload.descriptionSections);
assert.equal(parsed.neighborhoodDescription, payload.neighborhoodDescription);
assert.equal(parsed.gettingAround, payload.gettingAround);
assert.deepEqual(parsed.views, payload.views);
assert.deepEqual(parsed.amenities, payload.amenities);

assert.throws(() => updateListingSchema.parse({ descriptionSections: { property: "x".repeat(2000) } }));
console.log("E2 your-space part 1 structural persistence tests passed");
