import { prisma } from "@/lib/db/prisma";
import { getOrSetCache, deleteCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";

const CACHE_KEY = CACHE_KEYS.APP_SETTINGS_HOST_SERVICE_FEE();
const NON_REFUNDABLE_DISCOUNT_CACHE_KEY = CACHE_KEYS.APP_SETTINGS_NON_REFUNDABLE_DISCOUNT();
const CACHE_TTL_VAL = CACHE_TTL.APP_SETTINGS;

export type HomepagePopularHomesMode = "STATIC" | "USER_LOCATION" | "USER_IP";

export interface HomepagePopularHomesConfig {
  mode: HomepagePopularHomesMode;
  city: string;
  title: string;
  enabled: boolean;
}

export interface ReferralProgramConfig {
  enabled: boolean;
  inviterRewardPoints: number;
  qualifyingCondition: "FIRST_COMPLETED_STAY";
}

const HOMEPAGE_POPULAR_HOMES_CONFIG_KEY = "HOMEPAGE_POPULAR_HOMES_CONFIG";
const REFERRAL_PROGRAM_CONFIG_KEY = "REFERRAL_PROGRAM_CONFIG";
const DEFAULT_HOMEPAGE_POPULAR_HOMES_CONFIG: HomepagePopularHomesConfig = {
  mode: "STATIC",
  city: "Riyadh",
  title: "Popular homes in Riyadh",
  enabled: true,
};

function normalizeHomepagePopularHomesConfig(
  config?: Partial<HomepagePopularHomesConfig> | null,
): HomepagePopularHomesConfig {
  const mode = config?.mode === "USER_LOCATION" || config?.mode === "USER_IP" ? config.mode : "STATIC";
  const city = (config?.city ?? DEFAULT_HOMEPAGE_POPULAR_HOMES_CONFIG.city).trim();
  const title = (config?.title ?? (city ? `Popular homes in ${city}` : DEFAULT_HOMEPAGE_POPULAR_HOMES_CONFIG.title)).trim();

  return {
    mode,
    city: city || DEFAULT_HOMEPAGE_POPULAR_HOMES_CONFIG.city,
    title: title || DEFAULT_HOMEPAGE_POPULAR_HOMES_CONFIG.title,
    enabled: config?.enabled !== false,
  };
}

/**
 * Referral rewards remain disabled until an administrator configures the
 * program. This intentionally has no reward fallback: a credit must never be
 * invented when the business rule is absent.
 */
export async function getReferralProgramConfig(): Promise<ReferralProgramConfig | null> {
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key: REFERRAL_PROGRAM_CONFIG_KEY },
    });
    if (!setting?.value) return null;

    const parsed = JSON.parse(setting.value) as Partial<ReferralProgramConfig>;
    const points = Number(parsed.inviterRewardPoints);
    if (
      parsed.enabled !== true ||
      parsed.qualifyingCondition !== "FIRST_COMPLETED_STAY" ||
      !Number.isInteger(points) ||
      points <= 0
    ) {
      return null;
    }

    return {
      enabled: true,
      inviterRewardPoints: points,
      qualifyingCondition: "FIRST_COMPLETED_STAY",
    };
  } catch (error) {
    console.error("[AppSettings] Error fetching referral program configuration:", error);
    return null;
  }
}

/**
 * Get the current Host Service Fee percentage from app settings.
 * Fetches from cache first, then database, with a 1-hour TTL.
 * Defaults to 15% if not configured.
 */
export async function getHostServiceFeePercentage(): Promise<number> {
  try {
    const cached = await getOrSetCache(CACHE_KEY, async () => {
      const setting = await prisma.appSettings.findUnique({
        where: { key: "HOST_SERVICE_FEE_PERCENTAGE" },
      });

      if (!setting || !setting.value) {
        return 15; // Default to 15% if not set
      }

      const percentage = parseFloat(setting.value);
      return isNaN(percentage) ? 15 : Math.max(0, Math.min(100, percentage));
    }, { ttl: CACHE_TTL_VAL });

    return cached as number;
  } catch (error) {
    console.error("[AppSettings] Error fetching Host Service Fee:", error);
    return 15; // Fallback to 15%
  }
}

/**
 * Update the Host Service Fee percentage.
 * Clears the cache to force refresh on next request.
 */
export async function updateHostServiceFeePercentage(
  percentage: number,
  updatedBy?: string
): Promise<number> {
  // Validate percentage
  const validPercentage = Math.max(0, Math.min(100, parseFloat(percentage.toString())));

  try {
    const updated = await prisma.appSettings.upsert({
      where: { key: "HOST_SERVICE_FEE_PERCENTAGE" },
      update: {
        value: validPercentage.toString(),
        updatedBy: updatedBy || null,
        updatedAt: new Date(),
      },
      create: {
        key: "HOST_SERVICE_FEE_PERCENTAGE",
        value: validPercentage.toString(),
        description:
          "Platform service fee charged to hosts as a percentage of base price",
        dataType: "NUMBER",
        category: "PRICING",
        isPublic: false,
        updatedBy: updatedBy || null,
      },
    });

    // Clear cache to force refresh
    await deleteCache(CACHE_KEY);

    return validPercentage;
  } catch (error) {
    console.error("[AppSettings] Error updating Host Service Fee:", error);
    throw error;
  }
}

/**
 * Returns the administrator-configured non-refundable discount, or null when
 * the platform has not configured one. Intentionally no fallback percentage:
 * non-refundable pricing must never invent a discount.
 */
export async function getNonRefundableDiscountPercentage(): Promise<number | null> {
  try {
    const cached = await getOrSetCache(NON_REFUNDABLE_DISCOUNT_CACHE_KEY, async () => {
      const setting = await prisma.appSettings.findUnique({
        where: { key: "NON_REFUNDABLE_DISCOUNT_PERCENTAGE" },
      });
      const percentage = setting?.value ? Number(setting.value) : NaN;
      return Number.isFinite(percentage) && percentage > 0 && percentage <= 100 ? percentage : null;
    }, { ttl: CACHE_TTL_VAL });
    return typeof cached === "number" ? cached : null;
  } catch (error) {
    console.error("[AppSettings] Error fetching non-refundable discount:", error);
    return null;
  }
}

export async function updateNonRefundableDiscountPercentage(
  percentage: number,
  updatedBy?: string,
): Promise<number> {
  const validPercentage = Math.max(0.01, Math.min(100, Number(percentage)));
  if (!Number.isFinite(validPercentage)) throw new Error("Non-refundable discount must be a number.");

  await prisma.appSettings.upsert({
    where: { key: "NON_REFUNDABLE_DISCOUNT_PERCENTAGE" },
    update: { value: validPercentage.toString(), updatedBy: updatedBy || null, updatedAt: new Date() },
    create: {
      key: "NON_REFUNDABLE_DISCOUNT_PERCENTAGE",
      value: validPercentage.toString(),
      description: "Discount applied to a guest-selected non-refundable reservation",
      dataType: "NUMBER",
      category: "PRICING",
      isPublic: false,
      updatedBy: updatedBy || null,
    },
  });
  await deleteCache(NON_REFUNDABLE_DISCOUNT_CACHE_KEY);
  return validPercentage;
}

/**
 * Get all app settings by category.
 */
export async function getSettingsByCategory(
  category: string
): Promise<Record<string, string | null>> {
  try {
    const settings = await prisma.appSettings.findMany({
      where: { category },
    });

    const result: Record<string, string | null> = {};
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
    return result;
  } catch (error) {
    console.error("[AppSettings] Error fetching settings by category:", error);
    return {};
  }
}

/**
 * Get a specific setting by key.
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key },
    });
    return setting?.value || null;
  } catch (error) {
    console.error(`[AppSettings] Error fetching setting ${key}:`, error);
    return null;
  }
}

/**
 * Update a specific setting.
 */
export async function updateSetting(
  key: string,
  value: string,
  updatedBy?: string
): Promise<void> {
  try {
    await prisma.appSettings.upsert({
      where: { key },
      update: {
        value,
        updatedBy: updatedBy || null,
        updatedAt: new Date(),
      },
      create: {
        key,
        value,
        dataType: "STRING",
        category: "GENERAL",
        isPublic: false,
        updatedBy: updatedBy || null,
      },
    });

    // Clear cache if applicable
  if (key === "HOST_SERVICE_FEE_PERCENTAGE") {
    await deleteCache(CACHE_KEY);
  }
  } catch (error) {
    console.error(`[AppSettings] Error updating setting ${key}:`, error);
    throw error;
  }
}

export async function getHomepagePopularHomesConfig(): Promise<HomepagePopularHomesConfig> {
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key: HOMEPAGE_POPULAR_HOMES_CONFIG_KEY },
    });

    if (!setting?.value) {
      return DEFAULT_HOMEPAGE_POPULAR_HOMES_CONFIG;
    }

    const parsed = JSON.parse(setting.value) as Partial<HomepagePopularHomesConfig> | null;
    return normalizeHomepagePopularHomesConfig(parsed);
  } catch (error) {
    console.error("[AppSettings] Error fetching homepage popular homes config:", error);
    return DEFAULT_HOMEPAGE_POPULAR_HOMES_CONFIG;
  }
}

export async function updateHomepagePopularHomesConfig(
  input: Partial<HomepagePopularHomesConfig>,
  updatedBy?: string,
): Promise<HomepagePopularHomesConfig> {
  const normalized = normalizeHomepagePopularHomesConfig(input);

  await prisma.appSettings.upsert({
    where: { key: HOMEPAGE_POPULAR_HOMES_CONFIG_KEY },
    update: {
      value: JSON.stringify(normalized),
      updatedBy: updatedBy || null,
      updatedAt: new Date(),
    },
    create: {
      key: HOMEPAGE_POPULAR_HOMES_CONFIG_KEY,
      value: JSON.stringify(normalized),
      description: "Homepage popular homes selection mode and city override.",
      dataType: "JSON",
      category: "GENERAL",
      isPublic: false,
      updatedBy: updatedBy || null,
    },
  });

  return normalized;
}

export const appSettingsService = {
  getHostServiceFeePercentage,
  updateHostServiceFeePercentage,
  getNonRefundableDiscountPercentage,
  updateNonRefundableDiscountPercentage,
  getSettingsByCategory,
  getSetting,
  updateSetting,
  getHomepagePopularHomesConfig,
  updateHomepagePopularHomesConfig,
  getReferralProgramConfig,
};
