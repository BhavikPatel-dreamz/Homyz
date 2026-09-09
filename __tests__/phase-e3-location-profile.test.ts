import assert from "node:assert/strict";
import { updateListingSchema } from "../lib/validation/listing";
import { coHostInvitationSchema, updateHostPublicProfileSchema } from "../lib/validation/host-profile";

const location = updateListingSchema.parse({
  locationFeatures: ["near_public_transport", "resort_access"],
  neighborhoodDescription: "A residential area with cafes and a short walk to the park.",
  gettingAround: "The metro is a 10-minute walk away and rideshare is widely available.",
  views: ["city_view", "garden_view"],
});
assert.deepEqual(location.locationFeatures, ["near_public_transport", "resort_access"]);
assert.throws(() => updateListingSchema.parse({ locationFeatures: ["beach_access"] }));

const profile = updateHostPublicProfileSchema.parse({
  bio: "I enjoy helping guests discover the city.",
  prompts: { homeUnique: "Sunset views from the terrace." },
  languages: ["en", "ar"],
  interests: ["travel", "architecture"],
  stampsVisible: true,
});
assert.equal(profile.prompts?.homeUnique, "Sunset views from the terrace.");
assert.throws(() => updateHostPublicProfileSchema.parse({ bio: "x".repeat(2001) }));
assert.equal(coHostInvitationSchema.parse({ email: "cohost@example.com" }).email, "cohost@example.com");
assert.throws(() => coHostInvitationSchema.parse({ email: "not-an-email" }));

console.log("E3 location, host profile, and co-host validation tests passed");
