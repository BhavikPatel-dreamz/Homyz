import assert from "node:assert/strict";
import { updateListingSchema } from "../lib/validation/listing";
import { createBookingSchema } from "../lib/validation/booking";
import { toPublicListingDTO } from "../services/mappers";

assert.equal(updateListingSchema.parse({ bookingMessage: "Welcome — please review the house rules." }).bookingMessage, "Welcome — please review the house rules.");
assert.throws(() => updateListingSchema.parse({ bookingMessage: "x".repeat(1001) }));
assert.equal(updateListingSchema.parse({ longTermCancellationPolicy: "STRICT" }).longTermCancellationPolicy, "STRICT");
assert.throws(() => updateListingSchema.parse({ longTermCancellationPolicy: "FLEXIBLE" }));
assert.equal(createBookingSchema.parse({ listingId: "listing", startDate: "2030-01-01", endDate: "2030-01-02" }).guests, 1);
assert.equal(createBookingSchema.parse({ listingId: "listing", startDate: "2030-01-01", endDate: "2030-01-02", pets: 2 }).pets, 2);
assert.throws(() => createBookingSchema.parse({ listingId: "listing", startDate: "2030-01-01", endDate: "2030-01-02", pets: -1 }));
assert.throws(() => createBookingSchema.parse({ listingId: "listing", startDate: "2030-01-01", endDate: "2030-01-02", pets: 25 }));

const publicListing = toPublicListingDTO({
  id: "listing", hostId: "host", title: "Test", description: "Test", price: 10000, published: true, status: "ACTIVE", hostingType: "HOME",
  propertyType: null, listingType: null, locationSearch: null, shortAddress: null, address: "1 Private Road", neighborhoodDescription: null, gettingAround: null, apartment: "5B", city: "Riyadh", district: null, postalCode: "12345", country: "Saudi Arabia", latitude: 24.7, longitude: 46.7, showExactLocation: false,
  guests: 2, bedrooms: 1, beds: 1, bathrooms: 1, propertySize: null, propertySizeUnit: null, listingFloor: null, totalFloors: null, yearBuilt: null, yearRenovated: null, privateEntrance: null, elevatorAvailable: null, stairsRequired: null, rooms: null, fullBathrooms: null, halfBathrooms: null, privateBathrooms: null, sharedBathrooms: null, parkingAvailable: null, parkingType: null, parkingSpaces: null, parkingReservation: null, guestAccess: [], photos: [], highlights: [], amenities: [], safetyDisclosures: [], safetyEquipment: [], safetyHazards: [], accessibilityFeatures: [], views: [], locationFeatures: [], houseRules: [], petsAllowed: false, maxPets: null, petFee: 2500, petRestrictions: null, dogsAllowed: null, catsAllowed: null, smokingAllowed: false, smokingLocation: null, eventsAllowed: false, childrenAllowed: null, infantsAllowed: null, photographyAllowed: false, quietHours: true, quietHoursStart: "22:00", quietHoursEnd: "07:00", additionalRules: null, checkInMethod: "SMART_LOCK", checkInStart: "15:00", checkInEnd: "22:00", checkOutTime: "11:00", directions: "private", parkingInstructions: "private", checkInInstructions: "private", houseManual: "private", wifiNetwork: "private", wifiPassword: "secret", doorCode: "secret", lockboxCode: "secret", cancellationPolicy: "FLEXIBLE", longTermCancellationPolicy: "FIRM", bookingMessage: "Welcome", minNights: 1, maxNights: 365, instantBook: true, isPaused: false, isFeatured: false, blockedDates: [], cleaningFee: 0, securityDeposit: 0, weekendPrice: null, weekendPremium: null, discounts: null, currentStep: 1, submittedAt: null, resubmittedAt: null, reviewStartedAt: null, reviewerId: null, rejectionReason: null, requestedChanges: null, approvedAt: null, approvedById: null, createdAt: new Date(), updatedAt: new Date(),
} as unknown as Parameters<typeof toPublicListingDTO>[0]);

assert.equal(publicListing.bookingMessage, "Welcome");
assert.equal("petFee" in publicListing, false);
for (const secret of ["wifiPassword", "doorCode", "lockboxCode", "checkInInstructions", "houseManual", "directions", "parkingInstructions"]) assert.equal(secret in publicListing, false);
console.log("E4 validation and public privacy foundations passed.");
