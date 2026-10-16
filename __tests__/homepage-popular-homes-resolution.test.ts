import assert from "node:assert/strict";
import { resolvePopularHomesCity } from "../services/homepage.service";

async function run() {
  const staticConfig = {
    mode: "STATIC" as const,
    city: "Riyadh",
    title: "Popular homes in Riyadh",
    enabled: true,
  };

  const locationConfig = {
    mode: "USER_LOCATION" as const,
    city: "Riyadh",
    title: "Popular homes in Riyadh",
    enabled: true,
  };

  const staticResult = await resolvePopularHomesCity(staticConfig, { city: "Paris" }, async () => "Paris");
  assert.equal(staticResult.city, "Riyadh", "STATIC mode keeps the configured city as the authoritative override");

  const locationResult = await resolvePopularHomesCity(locationConfig, { city: "Paris", lat: 48.8566, lng: 2.3522 }, async () => "Paris");
  assert.equal(locationResult.city, "Paris", "USER_LOCATION mode prefers the selected city before the static default");

  const fallbackResult = await resolvePopularHomesCity(locationConfig, { lat: 21.5433, lng: 39.1728 }, async () => "Jeddah");
  assert.equal(fallbackResult.city, "Jeddah", "Coordinate fallback resolves the current location city correctly");

  const disabledResult = await resolvePopularHomesCity({ ...locationConfig, enabled: false }, { city: "Paris" }, async () => "Paris");
  assert.equal(disabledResult.enabled, false, "Disabled config suppresses the section");

  console.log("Popular homes resolution tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
