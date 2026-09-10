/* eslint-disable @typescript-eslint/no-explicit-any -- legacy listing object surface */

export interface SafetyDeviceState {
  securityCamera: boolean | null;
  securityCameraDetails: string;
  noiseMonitor: boolean | null;
  noiseMonitorDetails: string;
  carbonMonoxideAlarm: boolean | null;
  carbonMonoxideAlarmDetails: string;
  smokeAlarm: boolean | null;
  smokeAlarmDetails: string;
}

export interface PropertyInfoState {
  climbStairs: boolean | null;
  climbStairsDetails: string;
  potentialNoise: boolean | null;
  potentialNoiseDetails: string;
  petsLiveOnProperty: boolean | null;
  petsLiveOnPropertyDetails: string;
  noParking: boolean | null;
  noParkingDetails: string;
  sharedSpaces: boolean | null;
  sharedSpacesDetails: string;
  limitedAmenities: boolean | null;
  limitedAmenitiesDetails: string;
  weapons: boolean | null;
  weaponsDetails: string;
}

export interface SafetyConsiderationsState {
  unsuitableChildren: boolean | null;
  unsuitableChildrenDetails: string;
  unsuitableInfants: boolean | null;
  unsuitableInfantsDetails: string;
  poolNoGate: boolean | null;
  poolNoGateDetails: string;
  nearbyWater: boolean | null;
  nearbyWaterDetails: string;
  climbingStructure: boolean | null;
  climbingStructureDetails: string;
  heightsNoRails: boolean | null;
  heightsNoRailsDetails: string;
  dangerousAnimals: boolean | null;
  dangerousAnimalsDetails: string;
  specialConsiderations: boolean | null;
  specialConsiderationsDetails: string;
}

export interface GuestSafetyState {
  devices: SafetyDeviceState;
  propertyInfo: PropertyInfoState;
  considerations: SafetyConsiderationsState;
}

export function sanitizeGuestSafetyState(state?: Partial<GuestSafetyState> | null): GuestSafetyState {
  return {
    devices: {
      securityCamera: state?.devices?.securityCamera ?? null,
      securityCameraDetails: state?.devices?.securityCameraDetails ?? "",
      noiseMonitor: state?.devices?.noiseMonitor ?? null,
      noiseMonitorDetails: state?.devices?.noiseMonitorDetails ?? "",
      carbonMonoxideAlarm: state?.devices?.carbonMonoxideAlarm ?? null,
      carbonMonoxideAlarmDetails: state?.devices?.carbonMonoxideAlarmDetails ?? "",
      smokeAlarm: state?.devices?.smokeAlarm ?? null,
      smokeAlarmDetails: state?.devices?.smokeAlarmDetails ?? "",
    },
    propertyInfo: {
      climbStairs: state?.propertyInfo?.climbStairs ?? null,
      climbStairsDetails: state?.propertyInfo?.climbStairsDetails ?? "",
      potentialNoise: state?.propertyInfo?.potentialNoise ?? null,
      potentialNoiseDetails: state?.propertyInfo?.potentialNoiseDetails ?? "",
      petsLiveOnProperty: state?.propertyInfo?.petsLiveOnProperty ?? null,
      petsLiveOnPropertyDetails: state?.propertyInfo?.petsLiveOnPropertyDetails ?? "",
      noParking: state?.propertyInfo?.noParking ?? null,
      noParkingDetails: state?.propertyInfo?.noParkingDetails ?? "",
      sharedSpaces: state?.propertyInfo?.sharedSpaces ?? null,
      sharedSpacesDetails: state?.propertyInfo?.sharedSpacesDetails ?? "",
      limitedAmenities: state?.propertyInfo?.limitedAmenities ?? null,
      limitedAmenitiesDetails: state?.propertyInfo?.limitedAmenitiesDetails ?? "",
      weapons: state?.propertyInfo?.weapons ?? null,
      weaponsDetails: state?.propertyInfo?.weaponsDetails ?? "",
    },
    considerations: {
      unsuitableChildren: state?.considerations?.unsuitableChildren ?? null,
      unsuitableChildrenDetails: state?.considerations?.unsuitableChildrenDetails ?? "",
      unsuitableInfants: state?.considerations?.unsuitableInfants ?? null,
      unsuitableInfantsDetails: state?.considerations?.unsuitableInfantsDetails ?? "",
      poolNoGate: state?.considerations?.poolNoGate ?? null,
      poolNoGateDetails: state?.considerations?.poolNoGateDetails ?? "",
      nearbyWater: state?.considerations?.nearbyWater ?? null,
      nearbyWaterDetails: state?.considerations?.nearbyWaterDetails ?? "",
      climbingStructure: state?.considerations?.climbingStructure ?? null,
      climbingStructureDetails: state?.considerations?.climbingStructureDetails ?? "",
      heightsNoRails: state?.considerations?.heightsNoRails ?? null,
      heightsNoRailsDetails: state?.considerations?.heightsNoRailsDetails ?? "",
      dangerousAnimals: state?.considerations?.dangerousAnimals ?? null,
      dangerousAnimalsDetails: state?.considerations?.dangerousAnimalsDetails ?? "",
      specialConsiderations: state?.considerations?.specialConsiderations ?? null,
      specialConsiderationsDetails: state?.considerations?.specialConsiderationsDetails ?? "",
    },
  };
}

export function parseSafetyData(listing: any): GuestSafetyState {
  if (listing?.devices && listing?.propertyInfo && listing?.considerations) {
    return sanitizeGuestSafetyState(listing);
  }
  const disclosures: string[] = Array.isArray(listing?.safetyDisclosures) ? listing.safetyDisclosures : [];
  const equipment: string[] = Array.isArray(listing?.safetyEquipment) ? listing.safetyEquipment : [];
  const hazards: string[] = Array.isArray(listing?.safetyHazards) ? listing.safetyHazards : [];
  const amenities: string[] = Array.isArray(listing?.amenities) ? listing.amenities : [];

  const parseDisclosure = (key: string) => {
    const entry = disclosures.find((d) => d.startsWith(`${key}:`) || d === key);
    if (!entry) return { value: null, details: "" };
    const parts = entry.split(":");
    const val = parts[1] === "YES" ? true : parts[1] === "NO" ? false : null;
    const details = parts.slice(2).join(":");
    return { value: val, details };
  };

  const parseHazard = (key: string, legacyPatterns: RegExp[]) => {
    const entry = hazards.find((h) => h.startsWith(`${key}:`) || h === key);
    if (entry) {
      const parts = entry.split(":");
      const val = parts[1] === "YES" ? true : parts[1] === "NO" ? false : null;
      const details = parts.slice(2).join(":");
      return { value: val, details };
    }
    const legacyMatch = hazards.find((h) => legacyPatterns.some((pattern) => pattern.test(h)));
    if (legacyMatch) {
      return { value: true, details: "" };
    }
    return { value: null, details: "" };
  };

  const secCam = parseDisclosure("SECURITY_CAMERA");
  const noiseMon = parseDisclosure("NOISE_MONITOR");

  const hasSmoke = equipment.includes("SMOKE_ALARM") || amenities.includes("smoke_alarm") || disclosures.some((d) => d.startsWith("SMOKE_ALARM:YES"));
  const smokeDetailsEntry = equipment.find((e) => e.startsWith("SMOKE_ALARM_DETAILS:")) || disclosures.find((d) => d.startsWith("SMOKE_ALARM:YES:"));
  const smokeDetails = smokeDetailsEntry ? smokeDetailsEntry.split(":").slice(smokeDetailsEntry.startsWith("SMOKE_ALARM_DETAILS:") ? 1 : 2).join(":") : "";

  const coDisclosure = parseDisclosure("CARBON_MONOXIDE_ALARM");
  const hasCO = equipment.includes("CARBON_MONOXIDE_ALARM") || amenities.includes("carbon_monoxide_alarm") || disclosures.some((d) => d === "CARBON_MONOXIDE_ALARM:YES" || d.startsWith("CARBON_MONOXIDE_ALARM:YES:"));
  const coDetails = coDisclosure.details;

  const stairs = parseDisclosure("MUST_CLIMB_STAIRS");
  const noise = parseDisclosure("POTENTIAL_FOR_NOISE");
  const pets = parseDisclosure("PETS_LIVE_ON_PROPERTY");
  const parking = parseDisclosure("NO_PARKING_ON_PROPERTY");
  const shared = parseDisclosure("SHARED_SPACES");
  const limitedAmen = parseDisclosure("LIMITED_AMENITIES");
  const weapons = parseDisclosure("WEAPONS");

  const child = parseHazard("CHILDREN_UNSUITABLE", [/children/i]);
  const infant = parseHazard("INFANTS_UNSUITABLE", [/infant/i]);
  const pool = parseHazard("POOL_NO_GATE", [/pool/i]);
  const water = parseHazard("NEARBY_WATER", [/water|lake|river|ocean/i]);
  const climb = parseHazard("CLIMBING_PLAY_STRUCTURE", [/climb|play structure/i]);
  const heights = parseHazard("HEIGHTS_WITHOUT_RAILS", [/height|rail/i]);
  const dangerousAnimals = parseHazard("DANGEROUS_ANIMALS", [/animal/i]);
  const special = parseHazard("SPECIAL_CONSIDERATIONS", [/special/i]);

  return {
    devices: {
      securityCamera: secCam.value,
      securityCameraDetails: secCam.details,
      noiseMonitor: noiseMon.value,
      noiseMonitorDetails: noiseMon.details,
      carbonMonoxideAlarm: hasCO ? true : disclosures.includes("CARBON_MONOXIDE_ALARM:NO") ? false : null,
      carbonMonoxideAlarmDetails: coDetails,
      smokeAlarm: hasSmoke ? true : disclosures.includes("SMOKE_ALARM:NO") ? false : null,
      smokeAlarmDetails: smokeDetails,
    },
    propertyInfo: {
      climbStairs: stairs.value,
      climbStairsDetails: stairs.details,
      potentialNoise: noise.value,
      potentialNoiseDetails: noise.details,
      petsLiveOnProperty: pets.value,
      petsLiveOnPropertyDetails: pets.details,
      noParking: parking.value,
      noParkingDetails: parking.details,
      sharedSpaces: shared.value,
      sharedSpacesDetails: shared.details,
      limitedAmenities: limitedAmen.value,
      limitedAmenitiesDetails: limitedAmen.details,
      weapons: weapons.value,
      weaponsDetails: weapons.details,
    },
    considerations: {
      unsuitableChildren: child.value,
      unsuitableChildrenDetails: child.details,
      unsuitableInfants: infant.value,
      unsuitableInfantsDetails: infant.details,
      poolNoGate: pool.value,
      poolNoGateDetails: pool.details,
      nearbyWater: water.value,
      nearbyWaterDetails: water.details,
      climbingStructure: climb.value,
      climbingStructureDetails: climb.details,
      heightsNoRails: heights.value,
      heightsNoRailsDetails: heights.details,
      dangerousAnimals: dangerousAnimals.value,
      dangerousAnimalsDetails: dangerousAnimals.details,
      specialConsiderations: special.value,
      specialConsiderationsDetails: special.details,
    },
  };
}

export function serializeSafetyData({
  devices,
  propertyInfo,
  considerations,
  currentAmenities = [],
}: {
  devices: SafetyDeviceState;
  propertyInfo: PropertyInfoState;
  considerations: SafetyConsiderationsState;
  currentAmenities?: string[];
}) {
  const disclosures: string[] = [];
  const equipment: string[] = [];
  const hazards: string[] = [];
  const amenitySet = new Set(currentAmenities);

  // 1. Devices
  if (devices.securityCamera === true) {
    disclosures.push(`SECURITY_CAMERA:YES${devices.securityCameraDetails ? `:${devices.securityCameraDetails.trim()}` : ""}`);
  } else if (devices.securityCamera === false) {
    disclosures.push("SECURITY_CAMERA:NO");
  }

  if (devices.noiseMonitor === true) {
    disclosures.push(`NOISE_MONITOR:YES${devices.noiseMonitorDetails ? `:${devices.noiseMonitorDetails.trim()}` : ""}`);
  } else if (devices.noiseMonitor === false) {
    disclosures.push("NOISE_MONITOR:NO");
  }

  if (devices.carbonMonoxideAlarm === true) {
    equipment.push("CARBON_MONOXIDE_ALARM");
    amenitySet.add("carbon_monoxide_alarm");
    disclosures.push(`CARBON_MONOXIDE_ALARM:YES${devices.carbonMonoxideAlarmDetails ? `:${devices.carbonMonoxideAlarmDetails.trim()}` : ""}`);
  } else if (devices.carbonMonoxideAlarm === false) {
    amenitySet.delete("carbon_monoxide_alarm");
    disclosures.push("CARBON_MONOXIDE_ALARM:NO");
  }

  if (devices.smokeAlarm === true) {
    equipment.push("SMOKE_ALARM");
    if (devices.smokeAlarmDetails.trim()) {
      equipment.push(`SMOKE_ALARM_DETAILS:${devices.smokeAlarmDetails.trim()}`);
    }
    amenitySet.add("smoke_alarm");
    disclosures.push(`SMOKE_ALARM:YES${devices.smokeAlarmDetails ? `:${devices.smokeAlarmDetails.trim()}` : ""}`);
  } else if (devices.smokeAlarm === false) {
    amenitySet.delete("smoke_alarm");
    disclosures.push("SMOKE_ALARM:NO");
  }

  // 2. Property Info
  const addPropInfo = (key: string, val: boolean | null, details: string) => {
    if (val === true) {
      disclosures.push(`${key}:YES${details ? `:${details.trim()}` : ""}`);
    } else if (val === false) {
      disclosures.push(`${key}:NO`);
    }
  };

  addPropInfo("MUST_CLIMB_STAIRS", propertyInfo.climbStairs, propertyInfo.climbStairsDetails);
  addPropInfo("POTENTIAL_FOR_NOISE", propertyInfo.potentialNoise, propertyInfo.potentialNoiseDetails);
  addPropInfo("PETS_LIVE_ON_PROPERTY", propertyInfo.petsLiveOnProperty, propertyInfo.petsLiveOnPropertyDetails);
  addPropInfo("NO_PARKING_ON_PROPERTY", propertyInfo.noParking, propertyInfo.noParkingDetails);
  addPropInfo("SHARED_SPACES", propertyInfo.sharedSpaces, propertyInfo.sharedSpacesDetails);
  addPropInfo("LIMITED_AMENITIES", propertyInfo.limitedAmenities, propertyInfo.limitedAmenitiesDetails);
  addPropInfo("WEAPONS", propertyInfo.weapons, propertyInfo.weaponsDetails);

  // 3. Considerations
  const addHazard = (key: string, val: boolean | null, details?: string) => {
    if (val === true) {
      hazards.push(`${key}:YES${details ? `:${details.trim()}` : ""}`);
    } else if (val === false) {
      hazards.push(`${key}:NO`);
    }
  };

  addHazard("CHILDREN_UNSUITABLE", considerations.unsuitableChildren, considerations.unsuitableChildrenDetails);
  addHazard("INFANTS_UNSUITABLE", considerations.unsuitableInfants, considerations.unsuitableInfantsDetails);
  addHazard("POOL_NO_GATE", considerations.poolNoGate, considerations.poolNoGateDetails);
  addHazard("NEARBY_WATER", considerations.nearbyWater, considerations.nearbyWaterDetails);
  addHazard("CLIMBING_PLAY_STRUCTURE", considerations.climbingStructure, considerations.climbingStructureDetails);
  addHazard("HEIGHTS_WITHOUT_RAILS", considerations.heightsNoRails, considerations.heightsNoRailsDetails);
  addHazard("DANGEROUS_ANIMALS", considerations.dangerousAnimals, considerations.dangerousAnimalsDetails);
  addHazard("SPECIAL_CONSIDERATIONS", considerations.specialConsiderations, considerations.specialConsiderationsDetails);

  return {
    safetyDisclosures: disclosures,
    safetyEquipment: equipment,
    safetyHazards: hazards,
    amenities: Array.from(amenitySet),
  };
}

export type SafetyIconType = "co" | "smoke" | "noise" | "camera" | "stairs" | "shield";

export interface ActiveSafetyItem {
  id: string;
  label: string;
  iconType: SafetyIconType;
}

export function getActiveSafetyItems(state?: GuestSafetyState | null): ActiveSafetyItem[] {
  const sanitized = sanitizeGuestSafetyState(state);
  const items: ActiveSafetyItem[] = [];

  if (sanitized.devices.carbonMonoxideAlarm === true) {
    items.push({ id: "co", label: "Carbon monoxide alarm installed", iconType: "co" });
  }
  if (sanitized.devices.smokeAlarm === true) {
    items.push({ id: "smoke", label: "Smoke alarm installed", iconType: "smoke" });
  }
  if (sanitized.devices.noiseMonitor === true) {
    items.push({ id: "noise", label: "Noise decibel monitor present", iconType: "noise" });
  }
  if (sanitized.devices.securityCamera === true) {
    items.push({ id: "camera", label: "Exterior security camera present", iconType: "camera" });
  }
  if (sanitized.propertyInfo.climbStairs === true) {
    items.push({ id: "stairs", label: "Guests must climb stairs", iconType: "stairs" });
  }
  if (sanitized.propertyInfo.potentialNoise === true) {
    items.push({ id: "potNoise", label: "Potential noise during stays", iconType: "noise" });
  }
  if (sanitized.propertyInfo.petsLiveOnProperty === true) {
    items.push({ id: "pets", label: "Pet(s) live at the property", iconType: "shield" });
  }
  if (sanitized.propertyInfo.noParking === true) {
    items.push({ id: "parking", label: "No parking on the property", iconType: "shield" });
  }
  if (sanitized.propertyInfo.sharedSpaces === true) {
    items.push({ id: "shared", label: "Property has shared spaces", iconType: "shield" });
  }
  if (sanitized.propertyInfo.limitedAmenities === true) {
    items.push({ id: "amenities", label: "Limited essential amenities", iconType: "shield" });
  }
  if (sanitized.propertyInfo.weapons === true) {
    items.push({ id: "weapons", label: "Weapon(s) on the property", iconType: "shield" });
  }
  if (sanitized.considerations.unsuitableChildren === true) {
    items.push({ id: "children", label: "Not a good fit for children 2–12", iconType: "shield" });
  }
  if (sanitized.considerations.unsuitableInfants === true) {
    items.push({ id: "infants", label: "Not a good fit for infants under 2", iconType: "shield" });
  }
  if (sanitized.considerations.poolNoGate === true) {
    items.push({ id: "pool", label: "Pool or hot tub doesn't have a gate or lock", iconType: "shield" });
  }
  if (sanitized.considerations.nearbyWater === true) {
    items.push({ id: "water", label: "Nearby water, like a lake or river", iconType: "shield" });
  }
  if (sanitized.considerations.climbingStructure === true) {
    items.push({ id: "climb", label: "Climbing or play structure(s)", iconType: "shield" });
  }
  if (sanitized.considerations.heightsNoRails === true) {
    items.push({ id: "heights", label: "Heights without rails or protection", iconType: "shield" });
  }
  if (sanitized.considerations.dangerousAnimals === true) {
    items.push({ id: "animals", label: "Potentially dangerous animal(s)", iconType: "shield" });
  }
  if (sanitized.considerations.specialConsiderations === true) {
    items.push({ id: "special", label: "Special safety considerations", iconType: "shield" });
  }

  return items;
}
