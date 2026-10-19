import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/lib/auth/types";
import {
  GlobalSettingsPayloadSchema,
  type GlobalSettingsPayload,
} from "@/lib/cms/content-types";
import { auditService } from "@/services/audit.service";
import { revalidateTag, revalidatePath } from "next/cache";

export const GLOBAL_WEBSITE_SETTINGS_KEY = "GLOBAL_WEBSITE_SETTINGS";

export class CmsSettingsService {
  /**
   * Return baseline default global settings
   */
  getDefaultSettings(): GlobalSettingsPayload {
    return GlobalSettingsPayloadSchema.parse({});
  }

  /**
   * Retrieve current global website settings from AppSettings
   */
  async getGlobalSettings(): Promise<GlobalSettingsPayload> {
    try {
      const setting = await prisma.appSettings.findUnique({
        where: { key: GLOBAL_WEBSITE_SETTINGS_KEY },
      });

      if (setting && setting.value) {
        const parsedJson = JSON.parse(setting.value);
        const result = GlobalSettingsPayloadSchema.safeParse(parsedJson);
        if (result.success) {
          return result.data;
        }
        console.warn("[CmsSettingsService] Invalid settings payload in database, falling back to defaults:", result.error);
      }
    } catch (err) {
      console.warn("[CmsSettingsService] Error reading settings from database:", err);
    }

    return this.getDefaultSettings();
  }

  /**
   * Update and validate global website settings
   */
  async updateGlobalSettings(
    actor: AuthUser,
    payload: unknown
  ): Promise<GlobalSettingsPayload> {
    const validated = GlobalSettingsPayloadSchema.parse(payload);

    await prisma.appSettings.upsert({
      where: { key: GLOBAL_WEBSITE_SETTINGS_KEY },
      create: {
        key: GLOBAL_WEBSITE_SETTINGS_KEY,
        value: JSON.stringify(validated),
        description: "CMS Global Website Identity, Contact, Social, and Appearance Settings",
        dataType: "JSON",
      },
      update: {
        value: JSON.stringify(validated),
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_GLOBAL_SETTINGS_UPDATE",
      resourceType: "APP_SETTINGS",
      resourceId: GLOBAL_WEBSITE_SETTINGS_KEY,
      description: `Updated CMS global website settings`,
      metadata: {
        siteName: validated.siteName,
        defaultLocale: validated.defaultLocale,
      },
    });

    try {
      revalidateTag("app-settings", "max");
      revalidateTag("cms-content", "max");
      revalidatePath("/", "layout");
    } catch (err) {
      console.warn("[CmsSettingsService] Cache revalidation warning:", err);
    }

    return validated;
  }
}

export const cmsSettingsService = new CmsSettingsService();

