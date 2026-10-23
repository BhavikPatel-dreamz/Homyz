import "server-only";

import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";

/**
 * The billing provider is not configured yet, so entitlement state lives in
 * the host's existing private account profile. This is deliberately a read
 * model: it neither charges a host nor mutates subscription state.
 */
export type DashboardPlusStatus =
  | "STANDARD"
  | "ACTIVE"
  | "TRIAL"
  | "EXPIRED"
  | "CANCELLED"
  | "SUSPENDED"
  | "ADMIN_GRANTED";

export type DashboardAccessStatus =
  | "Standard"
  | "Plus — Paid"
  | "Plus — Admin Granted"
  | "Plus — Temporary"
  | "Plus — Expired";

export type EntitlementSource = "STANDARD_DEFAULT" | "PROFILE" | "ADMIN" | "SUBSCRIPTION";

export type HostDashboardGrantDetails = {
  id: string;
  hostId: string;
  featureKey: string;
  source: string;
  status: string; // "ACTIVE" | "REVOKED"
  startsAt: string;
  expiresAt: string | null;
  grantedById: string | null;
  grantedByAdmin?: { id: string; name: string | null; email: string | null } | null;
  revokedById: string | null;
  revokedByAdmin?: { id: string; name: string | null; email: string | null } | null;
  revokedAt: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StandardHostDashboardFeature =
  | "DASHBOARD_OVERVIEW"
  | "BASIC_EARNINGS"
  | "RESERVATIONS_AND_CALENDAR"
  | "BASIC_INSIGHTS"
  | "REVIEWS_AND_RATINGS"
  | "BASIC_LISTING_PERFORMANCE"
  | "LISTING_HEALTH_AND_OPPORTUNITIES"
  | "HOST_MANAGEMENT";

export type DashboardPlusFeature =
  | "ADVANCED_EARNINGS"
  | "REVPAN"
  | "BOOKING_BEHAVIOR"
  | "ADVANCED_PROPERTY_COMPARISON"
  | "OPERATIONS_AND_PROFITABILITY";

export type HostDashboardFeature = StandardHostDashboardFeature | DashboardPlusFeature;

export const HOST_DASHBOARD_FEATURES: Record<HostDashboardFeature, {
  tier: "STANDARD" | "PLUS";
  label: string;
  description: string;
}> = {
  DASHBOARD_OVERVIEW: {
    tier: "STANDARD",
    label: "Host dashboard overview",
    description: "Core host KPIs, reservations, calendar, and payout visibility.",
  },
  BASIC_EARNINGS: {
    tier: "STANDARD",
    label: "Basic earnings",
    description: "Monthly and yearly earnings, fee breakdowns, and upcoming payouts.",
  },
  RESERVATIONS_AND_CALENDAR: {
    tier: "STANDARD",
    label: "Reservations and calendar",
    description: "Booking and availability management for authorized listings.",
  },
  BASIC_INSIGHTS: {
    tier: "STANDARD",
    label: "Basic insights",
    description: "Occupancy, booking totals, cancellations, guest patterns, and check-in statistics.",
  },
  REVIEWS_AND_RATINGS: {
    tier: "STANDARD",
    label: "Reviews and ratings",
    description: "Host review and rating insights.",
  },
  BASIC_LISTING_PERFORMANCE: {
    tier: "STANDARD",
    label: "Basic listing performance",
    description: "Views, conversion, listing health, and supported basic price comparisons.",
  },
  LISTING_HEALTH_AND_OPPORTUNITIES: {
    tier: "STANDARD",
    label: "Listing health and opportunities",
    description: "Basic recommendations for the host's own listings.",
  },
  HOST_MANAGEMENT: {
    tier: "STANDARD",
    label: "Host management",
    description: "Standard host account and listing-management functionality.",
  },
  ADVANCED_EARNINGS: {
    tier: "PLUS",
    label: "Advanced earnings analytics",
    description: "Revenue, costs, profitability, and property financial comparisons.",
  },
  REVPAN: {
    tier: "PLUS",
    label: "Revenue per available night",
    description: "RevPAN and its property-level breakdown.",
  },
  BOOKING_BEHAVIOR: {
    tier: "PLUS",
    label: "Advanced booking behavior",
    description: "Booking-time, lead-time, stay-length, and portfolio comparison reports.",
  },
  ADVANCED_PROPERTY_COMPARISON: {
    tier: "PLUS",
    label: "Advanced property comparisons",
    description: "Detailed comparable-listing and peer benchmark data.",
  },
  OPERATIONS_AND_PROFITABILITY: {
    tier: "PLUS",
    label: "Operations and profitability",
    description: "Recorded operational costs and maintenance/cleaning analysis.",
  },
};

export type HostDashboardEntitlements = {
  plan: "STANDARD" | "DASHBOARD_PLUS";
  tier: "STANDARD" | "PLUS";
  status: DashboardPlusStatus;
  accessStatus: DashboardAccessStatus;
  expiresAt: string | null;
  source: EntitlementSource;
  hasDashboardPlus: boolean;
  grantDetails?: HostDashboardGrantDetails | null;
  features: Record<HostDashboardFeature, boolean>;
  isGloballyDisabled?: boolean;
  isHostSuspended?: boolean;
};

type ProfileRecord = Record<string, unknown>;

function record(value: unknown): ProfileRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as ProfileRecord
    : null;
}

function parseStatus(value: unknown): DashboardPlusStatus {
  switch (typeof value === "string" ? value.trim().toUpperCase() : "") {
    case "ACTIVE": return "ACTIVE";
    case "TRIAL":
    case "TRIALING": return "TRIAL";
    case "EXPIRED": return "EXPIRED";
    case "CANCELLED":
    case "CANCELED": return "CANCELLED";
    case "SUSPENDED": return "SUSPENDED";
    case "ADMIN_GRANTED": return "ADMIN_GRANTED";
    default: return "STANDARD";
  }
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function enabledFeatures(plusEnabled: boolean): Record<HostDashboardFeature, boolean> {
  return Object.fromEntries(
    Object.entries(HOST_DASHBOARD_FEATURES).map(([key, feature]) => [
      key,
      feature.tier === "STANDARD" || plusEnabled,
    ]),
  ) as Record<HostDashboardFeature, boolean>;
}

export interface AdminGrantInput {
  id: string;
  hostId: string;
  featureKey: string;
  source: string;
  status: string;
  startsAt: Date | string;
  expiresAt: Date | string | null;
  grantedById?: string | null;
  grantedBy?: { id: string; name: string | null; email: string | null } | null;
  revokedById?: string | null;
  revokedBy?: { id: string; name: string | null; email: string | null } | null;
  revokedAt?: Date | string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ResolveEntitlementsOptions {
  userStatus?: string | null;
  adminGrant?: AdminGrantInput | null;
  latestGrant?: AdminGrantInput | null;
  globalPlusEnabled?: boolean;
}

function formatGrantDetails(grant?: AdminGrantInput | null): HostDashboardGrantDetails | null {
  if (!grant) return null;
  const starts = parseDate(grant.startsAt) ?? new Date();
  const expires = parseDate(grant.expiresAt);
  const revoked = parseDate(grant.revokedAt);
  const created = parseDate(grant.createdAt) ?? new Date();
  const updated = parseDate(grant.updatedAt) ?? new Date();

  return {
    id: grant.id,
    hostId: grant.hostId,
    featureKey: grant.featureKey,
    source: grant.source,
    status: grant.status,
    startsAt: starts.toISOString(),
    expiresAt: expires ? expires.toISOString() : null,
    grantedById: grant.grantedById ?? null,
    grantedByAdmin: grant.grantedBy ?? null,
    revokedById: grant.revokedById ?? null,
    revokedByAdmin: grant.revokedBy ?? null,
    revokedAt: revoked ? revoked.toISOString() : null,
    reason: grant.reason ?? null,
    notes: grant.notes ?? null,
    createdAt: created.toISOString(),
    updatedAt: updated.toISOString(),
  };
}

/**
 * Resolves effective entitlement implementing precedence rules:
 * 1. Host account suspended or ineligible -> enforce existing restrictions.
 * 2. Global Dashboard Plus disabled -> Plus features unavailable according to policy.
 * 3. Valid active paid Plus subscription -> Plus access.
 * 4. Valid active admin complimentary grant -> Plus access.
 * 5. Otherwise -> Standard Dashboard.
 */
export function resolveHostDashboardEntitlements(
  personalInfo: unknown,
  role?: Role,
  now = new Date(),
  options?: ResolveEntitlementsOptions,
): HostDashboardEntitlements {
  // Precedence 1: Host account is suspended or ineligible
  const userStatus = typeof options?.userStatus === "string" ? options.userStatus.toUpperCase() : null;
  if (userStatus === "SUSPENDED") {
    return {
      plan: "STANDARD",
      tier: "STANDARD",
      status: "SUSPENDED",
      accessStatus: "Standard",
      expiresAt: null,
      source: "STANDARD_DEFAULT",
      hasDashboardPlus: false,
      grantDetails: formatGrantDetails(options?.latestGrant || options?.adminGrant),
      features: enabledFeatures(false),
      isHostSuspended: true,
    };
  }

  // Precedence 2: Global Dashboard Plus is disabled
  if (options?.globalPlusEnabled === false) {
    return {
      plan: "STANDARD",
      tier: "STANDARD",
      status: "STANDARD",
      accessStatus: "Standard",
      expiresAt: null,
      source: "STANDARD_DEFAULT",
      hasDashboardPlus: false,
      grantDetails: formatGrantDetails(options?.latestGrant || options?.adminGrant),
      features: enabledFeatures(false),
      isGloballyDisabled: true,
    };
  }

  // Administrator role retention for platform maintenance & verification
  if (role === Role.ADMIN) {
    return {
      plan: "DASHBOARD_PLUS",
      tier: "PLUS",
      status: "ADMIN_GRANTED",
      accessStatus: "Plus — Admin Granted",
      expiresAt: null,
      source: "ADMIN",
      hasDashboardPlus: true,
      grantDetails: formatGrantDetails(options?.latestGrant || options?.adminGrant),
      features: enabledFeatures(true),
    };
  }

  // Inspect subscription state in user profile
  const info = record(personalInfo);
  const subscription = record(info?.dashboardPlus);
  const subStatus = parseStatus(subscription?.status);
  const subExpiresAt = parseDate(subscription?.expiresAt);
  const isSubExpired = subExpiresAt !== null && subExpiresAt <= now;
  const hasValidPaidSub = !isSubExpired && (subStatus === "ACTIVE" || subStatus === "TRIAL");

  // Inspect admin complimentary grant state
  const grant = options?.adminGrant;
  const grantStartsAt = grant ? parseDate(grant.startsAt) : null;
  const grantExpiresAt = grant ? parseDate(grant.expiresAt) : null;
  const isGrantScheduled = grantStartsAt !== null && grantStartsAt > now;
  const isGrantExpired = grantExpiresAt !== null && grantExpiresAt <= now;
  const isGrantActive = !!grant && grant.status === "ACTIVE" && !isGrantScheduled && !isGrantExpired;

  // Precedence 3: Valid active paid Plus subscription
  if (hasValidPaidSub) {
    return {
      plan: "DASHBOARD_PLUS",
      tier: "PLUS",
      status: subStatus,
      accessStatus: "Plus — Paid",
      expiresAt: subExpiresAt?.toISOString() ?? null,
      source: "SUBSCRIPTION",
      hasDashboardPlus: true,
      grantDetails: formatGrantDetails(options?.latestGrant || grant),
      features: enabledFeatures(true),
    };
  }

  // Precedence 4: Valid active admin complimentary grant
  if (isGrantActive) {
    return {
      plan: "DASHBOARD_PLUS",
      tier: "PLUS",
      status: "ADMIN_GRANTED",
      accessStatus: grantExpiresAt ? "Plus — Temporary" : "Plus — Admin Granted",
      expiresAt: grantExpiresAt?.toISOString() ?? null,
      source: "ADMIN",
      hasDashboardPlus: true,
      grantDetails: formatGrantDetails(grant),
      features: enabledFeatures(true),
    };
  }

  // Check for expired complimentary grant
  const historicalGrant = options?.latestGrant || grant;
  const histExpiresAt = historicalGrant ? parseDate(historicalGrant.expiresAt) : null;
  const hadExpiredComplimentaryGrant =
    (historicalGrant && histExpiresAt !== null && histExpiresAt <= now) ||
    (!subscription && subStatus === "ADMIN_GRANTED" && isSubExpired) ||
    (subscription && subStatus === "ADMIN_GRANTED" && isSubExpired);

  if (hadExpiredComplimentaryGrant) {
    return {
      plan: "STANDARD",
      tier: "STANDARD",
      status: "EXPIRED",
      accessStatus: "Plus — Expired",
      expiresAt: (histExpiresAt || subExpiresAt)?.toISOString() ?? null,
      source: "ADMIN",
      hasDashboardPlus: false,
      grantDetails: formatGrantDetails(historicalGrant),
      features: enabledFeatures(false),
    };
  }

  // Profile-based fallback (e.g. legacy profile fields or non-active subscription statuses)
  if (subscription) {
    const isProfileAdminGrant = subStatus === "ADMIN_GRANTED";
    const profileHasPlus = !isSubExpired && (subStatus === "ACTIVE" || subStatus === "TRIAL" || isProfileAdminGrant);
    const effectiveStatus: DashboardPlusStatus = isSubExpired && !profileHasPlus && (
      subStatus === "ACTIVE" || subStatus === "TRIAL" || isProfileAdminGrant
    ) ? "EXPIRED" : subStatus;

    const accessStatus: DashboardAccessStatus =
      profileHasPlus
        ? (isProfileAdminGrant ? (subExpiresAt ? "Plus — Temporary" : "Plus — Admin Granted") : "Plus — Paid")
        : (effectiveStatus === "EXPIRED" ? "Plus — Expired" : "Standard");

    return {
      plan: profileHasPlus ? "DASHBOARD_PLUS" : "STANDARD",
      tier: profileHasPlus ? "PLUS" : "STANDARD",
      status: effectiveStatus,
      accessStatus,
      expiresAt: subExpiresAt?.toISOString() ?? null,
      source: isProfileAdminGrant ? "ADMIN" : "PROFILE",
      hasDashboardPlus: profileHasPlus,
      grantDetails: formatGrantDetails(historicalGrant),
      features: enabledFeatures(profileHasPlus),
    };
  }

  // Precedence 5: Standard Dashboard (safe default)
  return {
    plan: "STANDARD",
    tier: "STANDARD",
    status: "STANDARD",
    accessStatus: "Standard",
    expiresAt: null,
    source: "STANDARD_DEFAULT",
    hasDashboardPlus: false,
    grantDetails: formatGrantDetails(historicalGrant),
    features: enabledFeatures(false),
  };
}

export async function getHostDashboardEntitlements(
  actor: Pick<AuthUser, "id" | "role">,
  now = new Date(),
): Promise<HostDashboardEntitlements> {
  if (actor.role === Role.ADMIN) {
    return resolveHostDashboardEntitlements(null, actor.role, now);
  }

  const [user, activeGrant, latestGrant, globalSetting] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actor.id },
      select: { personalInfo: true, status: true, role: true },
    }),
    prisma.hostEntitlementGrant.findFirst({
      where: {
        hostId: actor.id,
        featureKey: "DASHBOARD_PLUS",
        status: "ACTIVE",
      },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
        revokedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
    prisma.hostEntitlementGrant.findFirst({
      where: {
        hostId: actor.id,
        featureKey: "DASHBOARD_PLUS",
      },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
        revokedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
    prisma.appSettings.findUnique({
      where: { key: "DASHBOARD_PLUS_ENABLED" },
      select: { value: true },
    }).catch(() => null),
  ]);

  const globalPlusEnabled = globalSetting?.value
    ? globalSetting.value.toLowerCase() !== "false"
    : true;

  return resolveHostDashboardEntitlements(
    user?.personalInfo,
    actor.role,
    now,
    {
      userStatus: user?.status,
      adminGrant: activeGrant,
      latestGrant,
      globalPlusEnabled,
    },
  );
}

export async function getHostDashboardEntitlementsForHost(
  hostId: string,
  now = new Date(),
): Promise<HostDashboardEntitlements> {
  const [user, activeGrant, latestGrant, globalSetting] = await Promise.all([
    prisma.user.findUnique({
      where: { id: hostId },
      select: { personalInfo: true, status: true, role: true },
    }),
    prisma.hostEntitlementGrant.findFirst({
      where: {
        hostId,
        featureKey: "DASHBOARD_PLUS",
        status: "ACTIVE",
      },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
        revokedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
    prisma.hostEntitlementGrant.findFirst({
      where: {
        hostId,
        featureKey: "DASHBOARD_PLUS",
      },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
        revokedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
    prisma.appSettings.findUnique({
      where: { key: "DASHBOARD_PLUS_ENABLED" },
      select: { value: true },
    }).catch(() => null),
  ]);

  const globalPlusEnabled = globalSetting?.value
    ? globalSetting.value.toLowerCase() !== "false"
    : true;

  return resolveHostDashboardEntitlements(
    user?.personalInfo,
    user?.role,
    now,
    {
      userStatus: user?.status,
      adminGrant: activeGrant,
      latestGrant,
      globalPlusEnabled,
    },
  );
}

/** Pure enforcement step used by API/page guards and entitlement tests. */
export function assertHostDashboardFeatureAccess(
  entitlements: HostDashboardEntitlements,
  feature: DashboardPlusFeature,
): void {
  if (!entitlements.features[feature]) {
    throw AppError.forbidden(`${HOST_DASHBOARD_FEATURES[feature].label} requires an active Dashboard Plus entitlement.`);
  }
}

export async function requireHostDashboardFeature(
  actor: Pick<AuthUser, "id" | "role">,
  feature: DashboardPlusFeature,
): Promise<HostDashboardEntitlements> {
  const entitlements = await getHostDashboardEntitlements(actor);
  assertHostDashboardFeatureAccess(entitlements, feature);
  return entitlements;
}
