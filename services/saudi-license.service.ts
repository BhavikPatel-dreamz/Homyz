import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { isSaudiArabia } from "@/lib/location/address-countries";
import { acquireCacheLease, releaseCacheLease } from "@/lib/redis/cache";
import { invalidateListingCache } from "@/lib/redis/invalidation";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  LicenseAuthorizationStatus,
  LicenseVerificationSource,
  ListingApprovalMethod,
  ListingLicenseEligibilityStatus,
  ListingStatus,
  NotificationType,
  PropertyLicenseStatus,
} from "@/generated/prisma/enums";
import { auditService } from "@/services/audit.service";
import { listingService } from "@/services/listing.service";
import { notificationService } from "@/services/notification.service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

type ProviderResult = {
  status: PropertyLicenseStatus;
  licenseNumber: string;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  licenseCategory?: string | null;
  facilityName?: string | null;
  verifiedEntity?: string | null;
  requestId?: string | null;
  error?: string | null;
  source: LicenseVerificationSource;
  /** A sandbox response can exercise the UI but can never authorize production. */
  simulated: boolean;
  authorizesHost: boolean;
  propertyEligible: boolean;
  details?: Record<string, string | null>;
};

interface SaudiLicenseProvider {
  verifyLicense(licenseNumber: string): Promise<ProviderResult>;
}

const normalizedLicense = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
const SAUDI_PORTAL_BASE_URL = "https://customer-gateway.tourism.sa";
const SAUDI_TOKEN_PATH = "/api/facility-portal/developer/licensing/token";
const SAUDI_TRAVEL_AGENCY_VERIFY_PATH = "/api/developer-integration/licensing/verify/travel-agency";
let saudiPortalToken: { value: string; expiresAt: number } | null = null;

function maskedLicense(value: string): string {
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

/**
 * Opt-in operational logging for local integration debugging. Credentials,
 * bearer tokens and raw provider payloads must never be written to logs.
 */
function debugVerification(event: string, details: Record<string, unknown>) {
  if (process.env.SAUDI_LICENSE_DEBUG_LOGS !== "true") return;
  console.info(`[saudi-license] ${event}`, details);
}

class SandboxSaudiLicenseProvider implements SaudiLicenseProvider {
  async verifyLicense(input: string): Promise<ProviderResult> {
    const licenseNumber = normalizedLicense(input);
    const base = {
      licenseNumber,
      source: LicenseVerificationSource.SANDBOX,
      simulated: true,
      requestId: `sandbox-${licenseNumber.toLowerCase()}`,
      licenseCategory: "TOURIST_HOSPITALITY_FACILITY",
      facilityName: "Sandbox Hospitality Facility",
      verifiedEntity: "Sandbox Licensed Entity",
    };
    if (licenseNumber === "SA-SANDBOX-UNAVAILABLE") {
      return { ...base, status: PropertyLicenseStatus.UNAVAILABLE, error: "Sandbox provider is unavailable.", authorizesHost: false, propertyEligible: false };
    }
    if (licenseNumber === "SA-SANDBOX-EXPIRED") {
      return { ...base, status: PropertyLicenseStatus.EXPIRED, expiryDate: new Date("2020-01-01T00:00:00.000Z"), authorizesHost: false, propertyEligible: false };
    }
    if (licenseNumber === "SA-SANDBOX-REVOKED") {
      return { ...base, status: PropertyLicenseStatus.REVOKED, expiryDate: new Date("2030-01-01T00:00:00.000Z"), authorizesHost: false, propertyEligible: false };
    }
    if (licenseNumber === "SA-SANDBOX-SUSPENDED") {
      return { ...base, status: PropertyLicenseStatus.SUSPENDED, expiryDate: new Date("2030-01-01T00:00:00.000Z"), authorizesHost: false, propertyEligible: false };
    }
    if (licenseNumber === "SA-SANDBOX-UNAUTHORIZED") {
      return { ...base, status: PropertyLicenseStatus.ACTIVE, expiryDate: new Date("2030-01-01T00:00:00.000Z"), authorizesHost: false, propertyEligible: true };
    }
    if (licenseNumber === "SA-SANDBOX-NO-EXPIRY") {
      return { ...base, status: PropertyLicenseStatus.ACTIVE, expiryDate: null, authorizesHost: true, propertyEligible: true, error: "The provider did not return a trustworthy expiration date." };
    }
    if (licenseNumber === "SA-SANDBOX-ACTIVE") {
      return { ...base, status: PropertyLicenseStatus.ACTIVE, expiryDate: new Date("2030-01-01T00:00:00.000Z"), authorizesHost: true, propertyEligible: true };
    }
    return { ...base, status: PropertyLicenseStatus.INVALID, error: "License was not found in the sandbox fixtures.", authorizesHost: false, propertyEligible: false };
  }
}

class DisabledGovernmentSaudiLicenseProvider implements SaudiLicenseProvider {
  async verifyLicense(input: string): Promise<ProviderResult> {
    // The supplied endpoint is for travel agencies. Until the Ministry grants
    // the accommodation contract and host-authorization binding, fail closed.
    return {
      licenseNumber: normalizedLicense(input),
      status: PropertyLicenseStatus.UNAVAILABLE,
      source: LicenseVerificationSource.SAUDI_GOVERNMENT,
      simulated: false,
      authorizesHost: false,
      propertyEligible: false,
      error: "Saudi accommodation verification is not configured for this environment.",
    };
  }
}

function responseRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  if (object.license && typeof object.license === "object") return object.license as Record<string, unknown>;
  if (object.data && typeof object.data === "object") return responseRecord(object.data);
  if (Array.isArray(object.licenses) && object.licenses[0] && typeof object.licenses[0] === "object") return object.licenses[0] as Record<string, unknown>;
  return null;
}

function parsedSaudiDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function textField(record: Record<string, unknown>, ...names: string[]): string | null {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

class SaudiPortalTravelAgencyProvider implements SaudiLicenseProvider {
  private async getAccessToken(): Promise<string> {
    if (saudiPortalToken && saudiPortalToken.expiresAt > Date.now()) return saudiPortalToken.value;
    const integrationKey = process.env.SAUDI_LICENSE_INTEGRATION_KEY?.trim();
    const integrationSecret = process.env.SAUDI_LICENSE_INTEGRATION_SECRET?.trim();
    if (!integrationKey || !integrationSecret) throw new Error("Saudi Portal integration credentials are not configured.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${SAUDI_PORTAL_BASE_URL}${SAUDI_TOKEN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ integrationKey, integrationSecret }),
        signal: controller.signal,
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object") throw new Error(`Saudi Portal token request failed (${response.status}).`);
      const tokenBody = body as Record<string, unknown>;
      const token = [tokenBody.access_token, tokenBody.accessToken, tokenBody.token]
        .find((value): value is string => typeof value === "string" && value.length > 0);
      if (!token) throw new Error("Saudi Portal token response did not include an access token.");
      const expiresIn = typeof tokenBody.expires_in === "number" ? tokenBody.expires_in : 900;
      // Refresh one minute early; never print the token in diagnostics.
      saudiPortalToken = { value: token, expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000 };
      debugVerification("Saudi Portal token acquired", { expiresIn });
      return token;
    } finally {
      clearTimeout(timeout);
    }
  }

  async verifyLicense(input: string): Promise<ProviderResult> {
    const licenseNumber = normalizedLicense(input);
    try {
      const token = await this.getAccessToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(`${SAUDI_PORTAL_BASE_URL}${SAUDI_TRAVEL_AGENCY_VERIFY_PATH}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ licenseNumber }),
          signal: controller.signal,
          cache: "no-store",
        });
        const body: unknown = await response.json().catch(() => null);
        debugVerification("Saudi Portal verification HTTP response", {
          httpStatus: response.status,
          responseKeys: body && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : [],
        });
        if (response.status === 404) {
          return { licenseNumber, status: PropertyLicenseStatus.INVALID, source: LicenseVerificationSource.SAUDI_GOVERNMENT, simulated: false, authorizesHost: false, propertyEligible: false, error: "License was not found by the Saudi Tourism Portal." };
        }
        if (!response.ok) throw new Error(`Saudi Portal verification request failed (${response.status}).`);
        const license = responseRecord(body);
        if (!license) {
          return { licenseNumber, status: PropertyLicenseStatus.INVALID, source: LicenseVerificationSource.SAUDI_GOVERNMENT, simulated: false, authorizesHost: false, propertyEligible: false, error: "Saudi Portal returned no matching license record." };
        }
        const expiryDate = parsedSaudiDate(license.expiryDate);
        const issueDate = parsedSaudiDate(license.issueDate);
        const rawStatus = textField(license, "status", "licenseStatus", "statusEn")?.toUpperCase();
        const isExpired = Boolean(expiryDate && expiryDate.getTime() < Date.now());
        const status = isExpired
          ? PropertyLicenseStatus.EXPIRED
          : rawStatus?.includes("REVOK") ? PropertyLicenseStatus.REVOKED
            : rawStatus?.includes("SUSPEND") ? PropertyLicenseStatus.SUSPENDED
              // The Portal's successful record response is the documented evidence
              // available from this endpoint when it does not include a status field.
              : PropertyLicenseStatus.ACTIVE;
        const trustedForAutoApproval = process.env.SAUDI_LICENSE_TRAVEL_AGENCY_AUTO_APPROVAL_ENABLED === "true";
        const eligible = status === PropertyLicenseStatus.ACTIVE && Boolean(expiryDate);
        return {
          licenseNumber: textField(license, "licenseNumber") ?? licenseNumber,
          status,
          issueDate,
          expiryDate,
          licenseCategory: textField(license, "licenseCategory", "facilityTypeEn", "activityEn"),
          facilityName: textField(license, "facilityNameEn", "facilityNameAr"),
          verifiedEntity: textField(license, "facilityNameEn", "facilityNameAr"),
          source: LicenseVerificationSource.SAUDI_GOVERNMENT,
          simulated: false,
          // This endpoint does not return a separate host identity assertion.
          // Enabling this explicit flag is the deployment owner's acknowledgement
          // that a successful Portal record may approve their host workflow.
          authorizesHost: trustedForAutoApproval && eligible,
          propertyEligible: eligible,
          error: !expiryDate ? "Saudi Portal did not return a valid expiry date." : null,
          details: {
            activityAr: textField(license, "activityAr"),
            activityEn: textField(license, "activityEn"),
            officeTypeAr: textField(license, "officeTypeAr"),
            officeTypeEn: textField(license, "officeTypeEn"),
            regionNameAr: textField(license, "regionNameAr"),
            regionNameEn: textField(license, "regionNameEn"),
            cityNameAr: textField(license, "cityNameAr"),
            cityNameEn: textField(license, "cityNameEn"),
          },
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      return {
        licenseNumber,
        status: PropertyLicenseStatus.UNAVAILABLE,
        source: LicenseVerificationSource.SAUDI_GOVERNMENT,
        simulated: false,
        authorizesHost: false,
        propertyEligible: false,
        error: error instanceof Error ? error.message : "Saudi Portal verification is unavailable.",
      };
    }
  }
}

function provider(): SaudiLicenseProvider {
  const verificationEnabled = process.env.SAUDI_LICENSE_VERIFICATION_ENABLED === "true";
  const useSandbox = verificationEnabled
    && process.env.NODE_ENV !== "production"
    && process.env.SAUDI_LICENSE_PROVIDER === "sandbox";
  if (useSandbox) return new SandboxSaudiLicenseProvider();
  if (verificationEnabled && process.env.SAUDI_LICENSE_PROVIDER === "government") return new SaudiPortalTravelAgencyProvider();
  return new DisabledGovernmentSaudiLicenseProvider();
}

function automaticApprovalEnabled(result: ProviderResult): boolean {
  return process.env.NODE_ENV !== "production"
    && process.env.SAUDI_LICENSE_VERIFICATION_ENABLED === "true"
    && process.env.SAUDI_LICENSE_AUTO_APPROVAL_ENABLED === "true"
    && ((result.source === LicenseVerificationSource.SANDBOX && result.simulated)
      || result.source === LicenseVerificationSource.SAUDI_GOVERNMENT);
}

function eligibility(result: ProviderResult): ListingLicenseEligibilityStatus {
  if (result.status === PropertyLicenseStatus.EXPIRED) return ListingLicenseEligibilityStatus.EXPIRED;
  if (result.status === PropertyLicenseStatus.UNAVAILABLE) return ListingLicenseEligibilityStatus.PROVIDER_UNAVAILABLE;
  if (!result.authorizesHost) return ListingLicenseEligibilityStatus.AUTHORIZATION_REQUIRED;
  if (result.status === PropertyLicenseStatus.ACTIVE && result.propertyEligible && result.expiryDate && result.expiryDate >= new Date()) {
    return ListingLicenseEligibilityStatus.ELIGIBLE;
  }
  return ListingLicenseEligibilityStatus.INELIGIBLE;
}

async function getOwnedSaudiListing(actor: AuthUser, listingId: string, access: "view" | "manage" = "view") {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      host: { select: { id: true, name: true, email: true } },
      coHosts: { where: { userId: actor.id, status: "ACCEPTED" }, select: { id: true } },
    },
  });
  if (!listing) throw AppError.notFound("Listing not found");
  const isAuthorizedCoHost = listing.coHosts.length > 0;
  if (listing.hostId !== actor.id && actor.role !== "ADMIN" && !isAuthorizedCoHost) {
    throw AppError.forbidden("You cannot manage this listing's license.");
  }
  if (actor.role === "ADMIN") {
    const permission = access === "manage" ? PERMISSIONS.LISTINGS_EDIT : PERMISSIONS.LISTINGS_VIEW;
    if (!hasPermission(actor, permission)) throw AppError.forbidden(`Missing required permission: ${permission}`);
  }
  if (!isSaudiArabia(listing.country)) throw AppError.badRequest("Saudi license verification is only available for properties in Saudi Arabia.");
  return listing;
}

async function verifyForListing(actor: AuthUser, listingId: string, input: string) {
  const listing = await getOwnedSaudiListing(actor, listingId, "manage");
  const licenseNumber = normalizedLicense(input);
  if (!licenseNumber || licenseNumber.length > 120) throw AppError.validation("Enter a valid license number.");
  const knownLicense = await prisma.propertyLicense.findUnique({
    where: { licenseNumber_countryCode: { licenseNumber, countryCode: "SA" } },
    include: { ownerships: { select: { hostId: true } } },
  });
  if (knownLicense && !knownLicense.ownerships.some((ownership: { hostId: string }) => ownership.hostId === listing.hostId)) {
    throw AppError.forbidden("This license is already associated with another host. Contact support if it should be transferred.");
  }

  debugVerification("verification requested", {
    listingId,
    license: maskedLicense(licenseNumber),
    configuredProvider: process.env.SAUDI_LICENSE_PROVIDER ?? "government",
    verificationEnabled: process.env.SAUDI_LICENSE_VERIFICATION_ENABLED === "true",
    environment: process.env.NODE_ENV,
  });
  const result = await provider().verifyLicense(licenseNumber);
  debugVerification("verification response", {
    listingId,
    license: maskedLicense(licenseNumber),
    source: result.source,
    simulated: result.simulated,
    status: result.status,
    expiryDate: result.expiryDate?.toISOString() ?? null,
    propertyEligible: result.propertyEligible,
    hostAuthorized: result.authorizesHost,
    requestId: result.requestId ?? null,
    error: result.error ?? null,
  });
  const now = new Date();
  const nextVerificationAt = result.status === PropertyLicenseStatus.ACTIVE
    ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
    : null;
  const nextEligibility = eligibility(result);

  const saved = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.propertyLicense.findUnique({
      where: { licenseNumber_countryCode: { licenseNumber, countryCode: "SA" } },
    });
    const license = await tx.propertyLicense.upsert({
      where: { licenseNumber_countryCode: { licenseNumber, countryCode: "SA" } },
      create: {
        licenseNumber,
        countryCode: "SA",
        licenseCategory: result.licenseCategory ?? null,
        issueDate: result.issueDate ?? null,
        facilityName: result.facilityName ?? null,
        verifiedEntity: result.verifiedEntity ?? null,
        status: result.status,
        expiryDate: result.expiryDate ?? null,
        verificationSource: result.source,
        verificationMethod: result.simulated ? "SANDBOX_FIXTURE" : "GOVERNMENT_API",
        lastVerifiedAt: result.status === PropertyLicenseStatus.ACTIVE ? now : null,
        lastAttemptedAt: now,
        nextVerificationAt,
        verificationError: result.error ?? null,
      },
      update: {
        licenseCategory: result.licenseCategory ?? null,
        issueDate: result.issueDate ?? null,
        facilityName: result.facilityName ?? null,
        verifiedEntity: result.verifiedEntity ?? null,
        status: result.status,
        expiryDate: result.expiryDate ?? null,
        verificationSource: result.source,
        verificationMethod: result.simulated ? "SANDBOX_FIXTURE" : "GOVERNMENT_API",
        lastVerifiedAt: result.status === PropertyLicenseStatus.ACTIVE ? now : current?.lastVerifiedAt ?? null,
        lastAttemptedAt: now,
        nextVerificationAt,
        verificationError: result.error ?? null,
      },
    });
    const ownershipStatus = result.authorizesHost ? LicenseAuthorizationStatus.AUTHORIZED : LicenseAuthorizationStatus.PENDING;
    await tx.licenseOwnership.upsert({
      where: { licenseId_hostId: { licenseId: license.id, hostId: listing.hostId } },
      create: {
        licenseId: license.id,
        hostId: listing.hostId,
        authorizationStatus: ownershipStatus,
        authorizationMethod: result.authorizesHost ? (result.simulated ? "SANDBOX_SIMULATION" : "PROVIDER_CONFIRMED") : null,
        verifiedAt: result.authorizesHost ? now : null,
      },
      update: {
        authorizationStatus: ownershipStatus,
        authorizationMethod: result.authorizesHost ? (result.simulated ? "SANDBOX_SIMULATION" : "PROVIDER_CONFIRMED") : undefined,
        verifiedAt: result.authorizesHost ? now : undefined,
      },
    });
    await tx.propertyLicenseLink.upsert({
      where: { listingId },
      create: { listingId, licenseId: license.id, eligibilityStatus: nextEligibility },
      update: { licenseId: license.id, eligibilityStatus: nextEligibility },
    });
    await tx.listing.update({ where: { id: listingId }, data: { licenseEligibilityStatus: nextEligibility } });
    await tx.licenseVerificationHistory.create({
      data: {
        licenseId: license.id,
        hostId: listing.hostId,
        listingId,
        previousStatus: current?.status,
        newStatus: result.status,
        providerResultCategory: result.simulated ? "SANDBOX" : "GOVERNMENT_UNAVAILABLE",
        errorReason: result.error ?? null,
        requestId: result.requestId ?? null,
        metadata: { simulated: result.simulated, propertyEligible: result.propertyEligible, authorizesHost: result.authorizesHost, providerDetails: result.details ?? {} },
      },
    });
    return { license, eligibilityStatus: nextEligibility };
  });

  await invalidateListingCache(listingId, listing.hostId);
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "SAUDI_LICENSE_VERIFIED",
    resourceType: "Listing",
    resourceId: listingId,
    description: `Saudi license verification ${result.status.toLowerCase()} for listing "${listing.title}".`,
    metadata: { simulated: result.simulated, source: result.source, eligibilityStatus: saved.eligibilityStatus },
  });
  await notificationService.create({
    userId: listing.hostId,
    type: NotificationType.SYSTEM,
    title: result.status === PropertyLicenseStatus.ACTIVE && result.authorizesHost
      ? "Saudi license verified"
      : result.status === PropertyLicenseStatus.ACTIVE
        ? "Saudi license needs host authorization"
        : "Saudi license verification needs attention",
    message: result.status === PropertyLicenseStatus.ACTIVE && result.authorizesHost
      ? "Your Saudi property license was verified for this listing."
      : result.status === PropertyLicenseStatus.ACTIVE
        ? "The license is active, but host authorization is still required before automatic approval."
        : (result.error ?? "Your license is not currently eligible for automatic approval."),
    entityId: listingId,
    entityType: `SAUDI_LICENSE_VERIFICATION:${result.status}`,
    link: `/host/listings/${listingId}`,
  });

  // A revoked, suspended, invalid, or expired licence applies to every linked
  // property. Do not wait for the scheduled expiry pass before removing those
  // properties from search and new-booking eligibility.
  const blocksLinkedProperties = (
    [
      PropertyLicenseStatus.EXPIRED,
      PropertyLicenseStatus.REVOKED,
      PropertyLicenseStatus.SUSPENDED,
      PropertyLicenseStatus.INVALID,
    ] as PropertyLicenseStatus[]
  ).includes(result.status);
  if (blocksLinkedProperties) {
    const linked = await prisma.propertyLicenseLink.findMany({
      where: { licenseId: saved.license.id, listing: { published: true } },
      include: { listing: { select: { id: true, hostId: true } } },
    });
    if (linked.length) {
      const linkedIds = linked.map((entry: { listingId: string }) => entry.listingId);
      await prisma.$transaction([
        prisma.propertyLicenseLink.updateMany({
          where: { licenseId: saved.license.id },
          data: { eligibilityStatus: result.status === PropertyLicenseStatus.EXPIRED ? ListingLicenseEligibilityStatus.EXPIRED : ListingLicenseEligibilityStatus.INELIGIBLE },
        }),
        prisma.listing.updateMany({
          where: { id: { in: linkedIds } },
          data: {
            published: false,
            isPaused: true,
            licenseEligibilityStatus: result.status === PropertyLicenseStatus.EXPIRED ? ListingLicenseEligibilityStatus.EXPIRED : ListingLicenseEligibilityStatus.INELIGIBLE,
            licenseUnlistedAt: now,
            licenseUnlistingReason: `LICENSE_${result.status}`,
          },
        }),
      ]);
      await Promise.all(linked.flatMap(({ listing: linkedListing }: { listing: { id: string; hostId: string } }) => [
        invalidateListingCache(linkedListing.id, linkedListing.hostId),
        notificationService.create({
          userId: linkedListing.hostId,
          type: NotificationType.SYSTEM,
          title: "License issue — property unlisted",
          message: "Your property was unpublished because its linked Saudi license is no longer valid. Reverify a renewed license before requesting publication again.",
          entityId: linkedListing.id,
          entityType: `SAUDI_LICENSE_BLOCKED:${saved.license.id}`,
          link: `/host/listings/${linkedListing.id}`,
        }),
      ]));
    }
  }

  return {
    status: result.status,
    expiryDate: result.expiryDate?.toISOString() ?? null,
    licenseNumber,
    licenseCategory: result.licenseCategory ?? null,
    facilityName: result.facilityName ?? null,
    verifiedEntity: result.verifiedEntity ?? null,
    eligibilityStatus: saved.eligibilityStatus,
    automaticApprovalAvailable: automaticApprovalEnabled(result) && saved.eligibilityStatus === ListingLicenseEligibilityStatus.ELIGIBLE,
    simulated: result.simulated,
    error: result.error ?? null,
    lastVerifiedAt: result.status === PropertyLicenseStatus.ACTIVE ? now.toISOString() : null,
  };
}

async function getListingLicense(actor: AuthUser, listingId: string) {
  const listing = await getOwnedSaudiListing(actor, listingId);
  const link = await prisma.propertyLicenseLink.findUnique({
    where: { listingId },
    include: { license: { include: { ownerships: { where: { hostId: listing.hostId } } } } },
  });
  if (!link) return null;
  const ownership = link.license.ownerships[0];
  return {
    licenseNumber: link.license.licenseNumber,
    status: link.license.status,
    expiryDate: link.license.expiryDate?.toISOString() ?? null,
    lastVerifiedAt: link.license.lastVerifiedAt?.toISOString() ?? null,
    eligibilityStatus: link.eligibilityStatus,
    authorizationStatus: ownership?.authorizationStatus ?? LicenseAuthorizationStatus.PENDING,
    simulated: link.license.verificationSource === LicenseVerificationSource.SANDBOX,
    automaticApprovalAvailable: [LicenseVerificationSource.SANDBOX, LicenseVerificationSource.SAUDI_GOVERNMENT].includes(link.license.verificationSource)
      && link.eligibilityStatus === ListingLicenseEligibilityStatus.ELIGIBLE
      && process.env.NODE_ENV !== "production"
      && process.env.SAUDI_LICENSE_VERIFICATION_ENABLED === "true"
      && process.env.SAUDI_LICENSE_AUTO_APPROVAL_ENABLED === "true",
  };
}

/**
 * Stores a host/admin supplied Saudi licence number without treating it as
 * verified. Replacing a number deliberately removes this property's previous
 * eligibility until the new number is checked with the provider.
 */
async function saveLicenseForListing(actor: AuthUser, listingId: string, input: string, reason?: string) {
  const listing = await getOwnedSaudiListing(actor, listingId, "manage");
  const licenseNumber = normalizedLicense(input);
  if (!licenseNumber || licenseNumber.length > 120) throw AppError.validation("Enter a valid license number.");
  const changeReason = reason?.trim();
  if (actor.role === "ADMIN" && !changeReason) {
    throw AppError.validation("Enter a reason for this administrative license change.");
  }

  const previousLink = await prisma.propertyLicenseLink.findUnique({
    where: { listingId },
    include: { license: { select: { id: true, licenseNumber: true, status: true } } },
  });
  if (previousLink?.license.licenseNumber === licenseNumber) {
    return getLicenseManagement(actor, listingId);
  }

  const now = new Date();
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.propertyLicense.findUnique({
      where: { licenseNumber_countryCode: { licenseNumber, countryCode: "SA" } },
      include: { ownerships: { where: { hostId: listing.hostId }, select: { id: true } } },
    });

    // Neither a host nor an admin can attach a licence owned by another host
    // through this normal edit path. A transfer needs a separate audited
    // ownership process; saving a number must not manufacture authorization.
    if (existing && existing.ownerships.length === 0) {
      throw AppError.forbidden("This license is already associated with another host. Contact support if it should be transferred.");
    }

    const license = existing ?? await tx.propertyLicense.create({
      data: {
        licenseNumber,
        countryCode: "SA",
        status: PropertyLicenseStatus.PENDING,
        verificationSource: LicenseVerificationSource.SAUDI_GOVERNMENT,
        verificationMethod: "HOST_SUBMITTED",
      },
    });

    await tx.licenseOwnership.upsert({
      where: { licenseId_hostId: { licenseId: license.id, hostId: listing.hostId } },
      create: { licenseId: license.id, hostId: listing.hostId, authorizationStatus: LicenseAuthorizationStatus.PENDING },
      update: {},
    });
    await tx.propertyLicenseLink.upsert({
      where: { listingId },
      create: { listingId, licenseId: license.id, eligibilityStatus: ListingLicenseEligibilityStatus.PENDING },
      update: { licenseId: license.id, eligibilityStatus: ListingLicenseEligibilityStatus.PENDING },
    });
    await tx.listing.update({
      where: { id: listingId },
      data: {
        licenseEligibilityStatus: ListingLicenseEligibilityStatus.PENDING,
        ...(listing.published
          ? {
              published: false,
              isPaused: true,
              licenseUnlistedAt: now,
              licenseUnlistingReason: "LICENSE_REPLACED_REQUIRES_VERIFICATION",
            }
          : {}),
      },
    });
    await tx.licenseVerificationHistory.create({
      data: {
        licenseId: license.id,
        hostId: listing.hostId,
        listingId,
        previousStatus: previousLink?.license.status ?? null,
        newStatus: PropertyLicenseStatus.PENDING,
        providerResultCategory: "LICENSE_SAVED",
        metadata: {
          previousLicenseNumber: previousLink?.license.licenseNumber ?? null,
          licenseChanged: true,
          changedByAdmin: actor.role === "ADMIN",
          adminReason: actor.role === "ADMIN" ? changeReason : null,
        },
      },
    });
  });

  await invalidateListingCache(listingId, listing.hostId);
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "SAUDI_LICENSE_SAVED",
    resourceType: "Listing",
    resourceId: listingId,
    description: `Saudi license number ${previousLink ? "replaced" : "saved"} for listing "${listing.title}".`,
    metadata: {
      previousLicense: previousLink ? maskedLicense(previousLink.license.licenseNumber) : null,
      license: maskedLicense(licenseNumber),
      ...(actor.role === "ADMIN" ? { reason: changeReason } : {}),
    },
  });
  if (listing.published) {
    await notificationService.create({
      userId: listing.hostId,
      type: NotificationType.SYSTEM,
      title: "Property unlisted pending license verification",
      message: "Your license number changed. Reverify it before publishing this property again.",
      entityId: listingId,
      entityType: "SAUDI_LICENSE_REPLACED",
      link: `/host/listings/${listingId}/regulations`,
    });
  }
  return getLicenseManagement(actor, listingId);
}

async function reverifyForListing(actor: AuthUser, listingId: string) {
  const license = await getListingLicense(actor, listingId);
  if (!license) throw AppError.badRequest("Verify a Saudi license before requesting reverification.");
  return verifyForListing(actor, listingId, license.licenseNumber);
}

async function getLicenseManagement(actor: AuthUser, listingId: string) {
  const listing = await getOwnedSaudiListing(actor, listingId);
  const link = await prisma.propertyLicenseLink.findUnique({
    where: { listingId },
    include: {
      license: {
        include: {
          listingLinks: {
            include: { listing: { select: { id: true, hostId: true, title: true, status: true, published: true, licenseEligibilityStatus: true } } },
          },
          verificationHistory: { orderBy: { createdAt: "desc" }, take: 25 },
        },
      },
    },
  });
  if (!link) return null;
  const canSeeAllLinked = actor.role === "ADMIN";
  return {
    listing: {
      id: listing.id,
      title: listing.title,
      country: listing.country,
      status: listing.status,
      published: listing.published,
      approvalMethod: listing.approvalMethod,
      eligibilityStatus: link.eligibilityStatus,
      licenseUnlistingReason: listing.licenseUnlistingReason,
      ...(actor.role === "ADMIN" ? { host: listing.host } : {}),
    },
    license: {
      number: link.license.licenseNumber,
      status: link.license.status,
      issueDate: link.license.issueDate?.toISOString() ?? null,
      expiryDate: link.license.expiryDate?.toISOString() ?? null,
      lastVerifiedAt: link.license.lastVerifiedAt?.toISOString() ?? null,
      eligibilityStatus: link.eligibilityStatus,
      licenseCategory: link.license.licenseCategory,
      facilityName: link.license.facilityName,
      verifiedEntity: link.license.verifiedEntity,
      verificationSource: link.license.verificationSource,
      verificationMethod: link.license.verificationMethod,
      verificationError: link.license.verificationError,
    },
    linkedProperties: link.license.listingLinks
      .filter((entry: (typeof link.license.listingLinks)[number]) => canSeeAllLinked || entry.listing.hostId === listing.hostId)
      .map((entry: (typeof link.license.listingLinks)[number]) => ({
        id: entry.listing.id,
        title: entry.listing.title,
        status: entry.listing.status,
        published: entry.listing.published,
        eligibilityStatus: entry.eligibilityStatus,
      })),
    verificationHistory: link.license.verificationHistory.map((entry: (typeof link.license.verificationHistory)[number]) => ({
      id: entry.id,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      providerResultCategory: entry.providerResultCategory,
      errorReason: entry.errorReason,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

async function submitFinal(actor: AuthUser, listingId: string, requestedMethod: "automatic" | "manual") {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw AppError.notFound("Listing not found");
  if (listing.hostId !== actor.id && actor.role !== "ADMIN") {
    throw AppError.forbidden("You cannot submit this listing.");
  }
  const isSaudi = isSaudiArabia(listing.country);
  if (!isSaudi || requestedMethod === "manual") {
    await prisma.listing.update({ where: { id: listingId }, data: { approvalMethod: ListingApprovalMethod.MANUAL_REVIEW, currentStep: 21 } });
    return listingService.submitForReview(actor, listingId);
  }

  // Treat a previously saved verification as a cache, not publishing evidence.
  // Recheck at the authoritative provider immediately before automatic launch.
  await reverifyForListing(actor, listingId);

  const link = await prisma.propertyLicenseLink.findUnique({
    where: { listingId },
    include: { license: { include: { ownerships: { where: { hostId: listing.hostId } } } } },
  });
  const ownership = link?.license.ownerships[0];
  const canAutoApprove = process.env.NODE_ENV !== "production"
    && process.env.SAUDI_LICENSE_VERIFICATION_ENABLED === "true"
    && process.env.SAUDI_LICENSE_AUTO_APPROVAL_ENABLED === "true"
    && link?.eligibilityStatus === ListingLicenseEligibilityStatus.ELIGIBLE
    && [LicenseVerificationSource.SANDBOX, LicenseVerificationSource.SAUDI_GOVERNMENT].includes(link.license.verificationSource)
    && link.license.status === PropertyLicenseStatus.ACTIVE
    && Boolean(link.license.expiryDate && link.license.expiryDate >= new Date())
    && ownership?.authorizationStatus === LicenseAuthorizationStatus.AUTHORIZED;
  if (!canAutoApprove) {
    throw AppError.badRequest("Automatic approval is unavailable. Submit this listing for manual review.");
  }
  const readiness = listingService.getPublishReadiness(listing);
  if (!readiness.publishable) throw AppError.badRequest(`Cannot submit listing. Complete: ${readiness.missing.join(", ")}.`);

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: ListingStatus.APPROVED,
      approvalMethod: ListingApprovalMethod.SAUDI_LICENSE_AUTOMATIC,
      licenseEligibilityStatus: ListingLicenseEligibilityStatus.ELIGIBLE,
      approvedAt: new Date(),
      currentStep: 21,
    },
  });
  const published = await listingService.publish(actor, listingId);
  await notificationService.create({
    userId: listing.hostId,
    type: NotificationType.SYSTEM,
    title: "Listing automatically approved",
    message: "Your listing was approved and published through Saudi license verification.",
    entityId: listingId,
    entityType: "SAUDI_LICENSE_AUTO_APPROVAL",
    link: `/host/listings/${listingId}`,
  });
  return published;
}

async function enforceExpiry() {
  const lease = await acquireCacheLease("saudi-license-expiry", 10 * 60);
  if (!lease) return { checked: 0, unlisted: 0, skipped: true };
  try {
    const today = new Date();
    const expired = await prisma.propertyLicense.findMany({
      where: { status: PropertyLicenseStatus.ACTIVE, expiryDate: { lt: today } },
      include: { listingLinks: { include: { listing: true } } },
      take: 250,
    });
    let unlisted = 0;
    for (const license of expired) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.propertyLicense.update({ where: { id: license.id }, data: { status: PropertyLicenseStatus.EXPIRED, nextVerificationAt: null } });
        for (const link of license.listingLinks) {
          await tx.propertyLicenseLink.update({ where: { id: link.id }, data: { eligibilityStatus: ListingLicenseEligibilityStatus.EXPIRED } });
          const item = link.listing;
          await tx.listing.update({
            where: { id: item.id },
            data: {
              licenseEligibilityStatus: ListingLicenseEligibilityStatus.EXPIRED,
              ...(item.published ? { published: false, isPaused: true, licenseUnlistedAt: today, licenseUnlistingReason: "LICENSE_EXPIRED" } : {}),
            },
          });
        }
      });
      for (const link of license.listingLinks) {
        if (!link.listing.published) continue;
        unlisted += 1;
        await invalidateListingCache(link.listing.id, link.listing.hostId);
        await notificationService.create({
          userId: link.listing.hostId,
          type: NotificationType.SYSTEM,
          title: "License expired — property unlisted",
          message: "Your property was unpublished because its Saudi license has expired. Renew and verify it before requesting publication again.",
          entityId: link.listing.id,
          entityType: `SAUDI_LICENSE_EXPIRED:${license.id}`,
          link: `/host/listings/${link.listing.id}`,
        });
      }
    }
    return { checked: expired.length, unlisted, skipped: false };
  } finally {
    await releaseCacheLease(lease);
  }
}

export const saudiLicenseService = {
  verifyForListing,
  saveLicenseForListing,
  reverifyForListing,
  getListingLicense,
  getLicenseManagement,
  submitFinal,
  enforceExpiry,
};
