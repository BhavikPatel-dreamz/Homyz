import assert from "node:assert/strict";
import { updateListingSchema } from "../lib/validation/listing";
import { coHostInvitationSchema, updateHostPublicProfileSchema } from "../lib/validation/host-profile";
import { updateProfileSchema } from "../lib/validation/user";
import { parseSafetyData, sanitizeGuestSafetyState, serializeSafetyData } from "../app/(protected)/host/listings/[id]/components/guest-safety-helpers";

const location = updateListingSchema.parse({
  locationFeatures: ["near_public_transport", "resort_access"],
  neighborhoodDescription: "A residential area with cafes and a short walk to the park.",
  gettingAround: "The metro is a 10-minute walk away and rideshare is widely available.",
  views: ["city_view", "garden_view"],
});
assert.deepEqual(location.locationFeatures, ["near_public_transport", "resort_access"]);
assert.throws(() => updateListingSchema.parse({ locationFeatures: ["not_a_location_feature"] }));
assert.deepEqual(
  updateListingSchema.parse({ instantBook: false, bookingApprovalMode: "MANUAL" }),
  { instantBook: false, bookingApprovalMode: "MANUAL" },
);

const guestSafety = sanitizeGuestSafetyState();
guestSafety.propertyInfo.climbStairs = true;
guestSafety.propertyInfo.climbStairsDetails = "Two flights from the lobby to the apartment.";
guestSafety.propertyInfo.potentialNoise = true;
guestSafety.propertyInfo.potentialNoiseDetails = "Weekday construction across the street from 9 AM to 5 PM.";
guestSafety.considerations.nearbyWater = true;
guestSafety.considerations.nearbyWaterDetails = "An unfenced pond is 30 metres from the garden.";
guestSafety.considerations.dangerousAnimals = true;
guestSafety.considerations.dangerousAnimalsDetails = "Occasional snakes may be present in the surrounding woodland.";
guestSafety.considerations.specialConsiderations = true;
guestSafety.considerations.specialConsiderationsDetails = "Local regulations require quiet hours after 10 PM.";

const savedGuestSafety = serializeSafetyData({ ...guestSafety, currentAmenities: ["first_aid_kit", "fire_extinguisher"] });
assert.ok(savedGuestSafety.safetyDisclosures.includes("MUST_CLIMB_STAIRS:YES:Two flights from the lobby to the apartment."));
assert.ok(savedGuestSafety.safetyDisclosures.includes("POTENTIAL_FOR_NOISE:YES:Weekday construction across the street from 9 AM to 5 PM."));
assert.ok(savedGuestSafety.safetyHazards.includes("NEARBY_WATER:YES:An unfenced pond is 30 metres from the garden."));
assert.ok(savedGuestSafety.safetyHazards.includes("DANGEROUS_ANIMALS:YES:Occasional snakes may be present in the surrounding woodland."));
assert.ok(savedGuestSafety.safetyHazards.includes("SPECIAL_CONSIDERATIONS:YES:Local regulations require quiet hours after 10 PM."));
assert.ok(savedGuestSafety.amenities.includes("first_aid_kit"));
assert.ok(savedGuestSafety.amenities.includes("fire_extinguisher"));

const reopenedGuestSafety = parseSafetyData(savedGuestSafety);
assert.equal(reopenedGuestSafety.propertyInfo.climbStairs, true);
assert.equal(reopenedGuestSafety.propertyInfo.potentialNoiseDetails, "Weekday construction across the street from 9 AM to 5 PM.");
assert.equal(reopenedGuestSafety.considerations.nearbyWaterDetails, "An unfenced pond is 30 metres from the garden.");
assert.equal(reopenedGuestSafety.considerations.dangerousAnimals, true);
assert.equal(reopenedGuestSafety.considerations.specialConsiderationsDetails, "Local regulations require quiet hours after 10 PM.");

const removedGuestSafety = serializeSafetyData({
  ...reopenedGuestSafety,
  propertyInfo: {
    ...reopenedGuestSafety.propertyInfo,
    climbStairs: false,
    climbStairsDetails: "",
    potentialNoise: false,
    potentialNoiseDetails: "",
  },
  considerations: {
    ...reopenedGuestSafety.considerations,
    nearbyWater: false,
    nearbyWaterDetails: "",
    dangerousAnimals: false,
    dangerousAnimalsDetails: "",
    specialConsiderations: false,
    specialConsiderationsDetails: "",
  },
});
assert.ok(removedGuestSafety.safetyDisclosures.includes("MUST_CLIMB_STAIRS:NO"));
assert.ok(removedGuestSafety.safetyDisclosures.includes("POTENTIAL_FOR_NOISE:NO"));
assert.ok(removedGuestSafety.safetyHazards.includes("NEARBY_WATER:NO"));
assert.ok(removedGuestSafety.safetyHazards.includes("DANGEROUS_ANIMALS:NO"));
assert.ok(removedGuestSafety.safetyHazards.includes("SPECIAL_CONSIDERATIONS:NO"));
const reopenedRemovedGuestSafety = parseSafetyData(removedGuestSafety);
assert.equal(reopenedRemovedGuestSafety.propertyInfo.climbStairs, false);
assert.equal(reopenedRemovedGuestSafety.propertyInfo.potentialNoise, false);
assert.equal(reopenedRemovedGuestSafety.considerations.nearbyWater, false);
assert.equal(reopenedRemovedGuestSafety.considerations.dangerousAnimals, false);
assert.equal(reopenedRemovedGuestSafety.considerations.specialConsiderations, false);

const profile = updateHostPublicProfileSchema.parse({
  bio: "I enjoy helping guests discover the city.",
  prompts: { homeUnique: "Sunset views from the terrace." },
  languages: ["en", "ar"],
  interests: ["travel", "architecture"],
  stampsVisible: true,
});
assert.equal(profile.prompts?.homeUnique, "Sunset views from the terrace.");
assert.throws(() => updateHostPublicProfileSchema.parse({ bio: "x".repeat(2001) }));
assert.deepEqual(updateHostPublicProfileSchema.parse({ interests: ["Travel", "travel"], prompts: { hobbies: ["Cooking", "cooking"] } }).interests, ["Travel"]);
assert.throws(() => updateHostPublicProfileSchema.parse({ rating: 5 }));
assert.throws(() => updateProfileSchema.parse({ publicProfile: { rating: 5 } }));
assert.equal(coHostInvitationSchema.parse({ email: "cohost@example.com" }).email, "cohost@example.com");
assert.throws(() => coHostInvitationSchema.parse({ email: "not-an-email" }));

console.log("E3 location, host profile, and co-host validation tests passed");
