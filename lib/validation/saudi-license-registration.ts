export const PRIVATE_ACCOMMODATION_TYPE = "PRIVATE_SHORT_TERM_RENTAL";

export type SaudiRegistrationDetailsInput = {
  accommodationType: string;
  licenseNumber: string;
  nationalId: string;
};

/** Validates only the fields supported by the current Saudi provider contract. */
export function validateSaudiRegistrationDetails(input: SaudiRegistrationDetailsInput) {
  const accommodationType = input.accommodationType.trim();
  const licenseNumber = input.licenseNumber.trim().toUpperCase().replace(/\s+/g, "");
  const nationalId = input.nationalId.replace(/[\s-]+/g, "");
  if (accommodationType !== PRIVATE_ACCOMMODATION_TYPE) throw new Error("Select a supported accommodation type.");
  if (!/^[A-Z0-9][A-Z0-9-]{2,119}$/.test(licenseNumber)) throw new Error("Enter a valid property permit number.");
  if (!nationalId || nationalId.length < 10) throw new Error("Enter your national identification number.");
  return { accommodationType, licenseNumber, nationalId };
}
