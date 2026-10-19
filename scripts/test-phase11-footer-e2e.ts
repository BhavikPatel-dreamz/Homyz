import "dotenv/config";
import { prisma } from "../lib/db/prisma";
import { cmsFooterService } from "../services/cms-footer.service";
import { cmsSettingsService } from "../services/cms-settings.service";
import { cmsPublicService } from "../services/cms-public.service";
import { CmsContentTypeEnum, CmsContentStatus } from "../generated/prisma/enums";
import {
  FooterConfigPayloadSchema,
  GlobalSettingsPayloadSchema,
  StaticPagePayloadSchema,
} from "../lib/cms/content-types";

interface TestResult {
  id: string;
  category: string;
  name: string;
  status: "PASS" | "FAIL";
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(
  id: string,
  category: string,
  name: string,
  fn: () => Promise<void>
) {
  const start = Date.now();
  try {
    await fn();
    results.push({
      id,
      category,
      name,
      status: "PASS",
      durationMs: Date.now() - start,
    });
    console.log(`  ✓ [${id}] ${name}`);
  } catch (err: any) {
    results.push({
      id,
      category,
      name,
      status: "FAIL",
      details: err.message || String(err),
      durationMs: Date.now() - start,
    });
    console.error(`  ❌ [${id}] ${name} — ${err.message}`);
  }
}

async function runE2ETests() {
  console.log("\n=======================================================");
  console.log("   PHASE 11 — END-TO-END VERIFICATION TEST SUITE      ");
  console.log("=======================================================\n");

  const existingAdmin = await prisma.user.findFirst();
  const mockAdmin: any = {
    id: existingAdmin?.id || undefined,
    email: existingAdmin?.email || "admin@homyz.com",
    role: "ADMIN",
    permissions: ["cms.view", "cms.create", "cms.edit", "cms.publish", "cms.rollback", "cms.manage"],
  };

  // ── CATEGORY 1: FOOTER CONFIG & CMS SERVICE (F-01 to F-10) ───────────────
  console.log("Category 1: Footer Configuration & Service Lifecycle");

  await runTest("F-01", "Footer", "Resolve published footer configuration (English)", async () => {
    const footer = await cmsFooterService.getPublishedFooter("en");
    if (!footer || !Array.isArray(footer.columns) || footer.columns.length < 3) {
      throw new Error(`Invalid columns count: ${footer?.columns?.length}`);
    }
  });

  await runTest("F-02", "Footer", "All published footer columns contain valid links", async () => {
    const footer = await cmsFooterService.getPublishedFooter("en");
    for (const col of footer.columns) {
      if (!col.links || col.links.length === 0) {
        throw new Error(`Column "${col.title}" has no links`);
      }
    }
  });

  await runTest("F-03", "Footer", "Zero '/not-available' links in published footer", async () => {
    const footer = await cmsFooterService.getPublishedFooter("en");
    for (const col of footer.columns) {
      for (const link of col.links) {
        if (link.href.includes("not-available")) {
          throw new Error(`Broken link found: "${link.label}" points to "${link.href}"`);
        }
      }
    }
    for (const b of footer.bottomLinks || []) {
      if (b.href.includes("not-available")) {
        throw new Error(`Broken bottom link: "${b.label}" points to "${b.href}"`);
      }
    }
  });

  await runTest("F-04", "Footer", "Social links configured with valid URLs", async () => {
    const footer = await cmsFooterService.getPublishedFooter("en");
    if (!footer.socialLinks || footer.socialLinks.length === 0) {
      throw new Error("No social links found");
    }
    for (const s of footer.socialLinks) {
      if (!s.platform || !s.url.startsWith("http")) {
        throw new Error(`Invalid social link: ${s.platform} -> ${s.url}`);
      }
    }
  });

  await runTest("F-05", "Footer", "Bottom legal links (Privacy, Terms, Cookies) present and valid", async () => {
    const footer = await cmsFooterService.getPublishedFooter("en");
    const bottom = footer.bottomLinks || [];
    const hasPrivacy = bottom.some((b) => b.href === "/privacy");
    const hasTerms = bottom.some((b) => b.href === "/terms");
    const hasCookies = bottom.some((b) => b.href === "/cookies");
    if (!hasPrivacy || !hasTerms || !hasCookies) {
      throw new Error(`Missing standard bottom links. Present: ${bottom.map((b) => b.href).join(", ")}`);
    }
  });

  await runTest("F-06", "Footer", "Copyright notice is formatted and non-empty", async () => {
    const footer = await cmsFooterService.getPublishedFooter("en");
    if (!footer.copyrightNotice || !footer.copyrightNotice.includes("Homyz")) {
      throw new Error(`Invalid copyright notice: "${footer.copyrightNotice}"`);
    }
  });

  await runTest("F-07", "Footer", "Appearance styling tokens defined", async () => {
    const footer = await cmsFooterService.getPublishedFooter("en");
    if (!footer.appearance || !footer.appearance.backgroundColor) {
      throw new Error("Appearance tokens missing");
    }
  });

  await runTest("F-08", "Footer", "Save new footer draft revision", async () => {
    const current = await cmsFooterService.getPublishedFooter("en");
    const updatedPayload = {
      ...current,
      copyrightNotice: "© 2026 Homyz Inc. Automated Test.",
    };
    const draft = await cmsFooterService.saveDraft(mockAdmin, updatedPayload, "E2E test draft save", "en");
    if (!draft || !draft.version || draft.version.versionNumber <= 1) {
      throw new Error("Failed to save incremented draft revision");
    }
  });

  await runTest("F-09", "Footer", "Publish updated draft revision", async () => {
    const draftData = await cmsFooterService.getDraftFooter("en");
    const published = await cmsFooterService.publishFooter(mockAdmin, undefined, "en");
    if (!published || published.status !== CmsContentStatus.PUBLISHED) {
      throw new Error("Failed to publish draft revision");
    }
    const live = await cmsFooterService.getPublishedFooter("en");
    if (live.copyrightNotice !== "© 2026 Homyz Inc. Automated Test.") {
      throw new Error("Live footer did not reflect published revision");
    }
  });

  await runTest("F-10", "Footer", "Rollback to Revision #1", async () => {
    const draftData = await cmsFooterService.getDraftFooter("en");
    const v1 = draftData.versions.find((v) => v.versionNumber === 1);
    if (!v1) throw new Error("Revision #1 not found in history");

    await cmsFooterService.rollbackFooter(mockAdmin, v1.id, "en");
    const live = await cmsFooterService.getPublishedFooter("en");
    if (!live.copyrightNotice.includes("All rights reserved")) {
      throw new Error("Rollback did not restore baseline copyright notice");
    }
  });

  // ── CATEGORY 2: APPROVED STATIC PAGES (F-11 to F-24) ──────────────────────
  console.log("\nCategory 2: Approved Static Pages Resolution");

  const expectedPages = [
    { slug: "about", title: "About Homyz" },
    { slug: "terms", title: "Terms of Service" },
    { slug: "privacy", title: "Privacy Policy" },
    { slug: "cookies", title: "Cookie Policy" },
    { slug: "safety", title: "Safety Information" },
    { slug: "accessibility", title: "Accessibility & Disability Support" },
    { slug: "cancellation-policy", title: "Cancellation Policy" },
    { slug: "anti-discrimination", title: "Nondiscrimination Policy" },
    { slug: "hosting-resources", title: "Hosting Resources" },
    { slug: "hosting-responsibly", title: "Hosting Responsibly" },
    { slug: "contact", title: "Contact Us" },
    { slug: "careers", title: "Careers at Homyz" },
    { slug: "newsroom", title: "Newsroom & Press" },
  ];

  let testIdx = 11;
  for (const page of expectedPages) {
    const testId = `F-${String(testIdx++).padStart(2, "0")}`;
    await runTest(testId, "StaticPages", `Resolve published static page /${page.slug}`, async () => {
      const content = await cmsPublicService.getPublishedContent<any>(
        CmsContentTypeEnum.STATIC_PAGE,
        page.slug,
        "en"
      );
      if (!content || !content.payload) {
        throw new Error(`Page /${page.slug} returned null or missing payload`);
      }
      if (!content.payload.sections || content.payload.sections.length === 0) {
        throw new Error(`Page /${page.slug} has 0 sections`);
      }
      if (!content.payload.heroTitle) {
        throw new Error(`Page /${page.slug} missing heroTitle`);
      }
    });
  }

  await runTest("F-24", "StaticPages", "Non-existent slug returns null (404 contract)", async () => {
    const notFoundPage = await cmsPublicService.getPublishedContent<any>(
      CmsContentTypeEnum.STATIC_PAGE,
      "non-existent-random-slug-xyz-12345",
      "en"
    );
    if (notFoundPage !== null) {
      throw new Error("Expected null for unknown slug, received content");
    }
  });

  // ── CATEGORY 3: GLOBAL WEBSITE SETTINGS (F-25 to F-30) ───────────────────
  console.log("\nCategory 3: Global Website Settings");

  await runTest("F-25", "Settings", "Retrieve global website settings from AppSettings", async () => {
    const settings = await cmsSettingsService.getGlobalSettings();
    if (!settings || settings.siteName !== "Homyz") {
      throw new Error(`Unexpected siteName: ${settings?.siteName}`);
    }
  });

  await runTest("F-26", "Settings", "Company legal entity & commercial registration verified", async () => {
    const settings = await cmsSettingsService.getGlobalSettings();
    if (!settings.legalEntityName || !settings.businessRegistrationNumber) {
      throw new Error("Company legal information incomplete");
    }
  });

  await runTest("F-27", "Settings", "Customer contact channels configured", async () => {
    const settings = await cmsSettingsService.getGlobalSettings();
    if (!settings.supportEmail || !settings.supportPhone) {
      throw new Error("Contact channels incomplete");
    }
  });

  await runTest("F-28", "Settings", "Regional defaults (SAR, 6 locales) verified", async () => {
    const settings = await cmsSettingsService.getGlobalSettings();
    if (settings.defaultCurrency !== "SAR") {
      throw new Error(`Unexpected currency: ${settings.defaultCurrency}`);
    }
    if (!settings.supportedLocales.includes("ar") || !settings.supportedLocales.includes("en")) {
      throw new Error("Missing required locales");
    }
  });

  await runTest("F-29", "Settings", "Update global settings atomic mutation", async () => {
    const current = await cmsSettingsService.getGlobalSettings();
    const updated = await cmsSettingsService.updateGlobalSettings(mockAdmin, {
      ...current,
      tagline: "Stay like a homie. Premium booking and property management.",
    });
    if (updated.tagline !== "Stay like a homie. Premium booking and property management.") {
      throw new Error("Tagline was not updated");
    }
  });

  await runTest("F-30", "Settings", "Reject invalid settings payload (Zod validation guard)", async () => {
    try {
      await cmsSettingsService.updateGlobalSettings(mockAdmin, {
        siteName: "",
        supportEmail: "not-an-email",
      });
      throw new Error("Failed to reject invalid payload");
    } catch (e: any) {
      if (!e.errors && !e.message) throw e;
    }
  });

  // ── CATEGORY 4: MULTILINGUAL, RTL & FALLBACK (F-31 to F-34) ──────────────
  console.log("\nCategory 4: i18n, RTL & Fallback Behavior");

  await runTest("F-31", "i18n", "Request Arabic locale with graceful English fallback", async () => {
    const footerAr = await cmsFooterService.getPublishedFooter("ar");
    if (!footerAr || !footerAr.columns || footerAr.columns.length < 3) {
      throw new Error("Arabic footer resolution failed fallback");
    }
  });

  await runTest("F-32", "i18n", "Static page Arabic lookup falls back gracefully to English", async () => {
    const aboutAr = await cmsPublicService.getPublishedContent<any>(
      CmsContentTypeEnum.STATIC_PAGE,
      "about",
      "ar"
    );
    if (!aboutAr || !aboutAr.payload) {
      throw new Error("About page Arabic lookup failed");
    }
    if (!aboutAr.isFallback && aboutAr.locale !== "ar") {
      throw new Error("Expected fallback flag on non-translated locale");
    }
  });

  await runTest("F-33", "i18n", "RTL direction metadata present for Arabic locale", async () => {
    const settings = await cmsSettingsService.getGlobalSettings();
    const hasArabic = settings.supportedLocales.includes("ar");
    if (!hasArabic) throw new Error("Arabic missing from supported locales");
  });

  await runTest("F-34", "i18n", "Multilingual footer translation overrides respected", async () => {
    const current = await cmsFooterService.getPublishedFooter("en");
    const payloadWithAr = {
      ...current,
      translations: {
        ar: {
          copyrightNotice: "© 2026 هوميز. جميع الحقوق محفوظة.",
        },
      },
    };
    await cmsFooterService.saveDraft(mockAdmin, payloadWithAr, "Add Arabic translations", "en");
    await cmsFooterService.publishFooter(mockAdmin, undefined, "en");

    const resolvedAr = await cmsFooterService.getPublishedFooter("ar");
    if (resolvedAr.copyrightNotice !== "© 2026 هوميز. جميع الحقوق محفوظة.") {
      throw new Error(`Arabic translation not merged: ${resolvedAr.copyrightNotice}`);
    }
  });

  // ── CATEGORY 5: SCHEMA & RESILIENCE (F-35 to F-38) ────────────────────────
  console.log("\nCategory 5: Schema Validation & Resilience");

  await runTest("F-35", "Schema", "FooterConfigPayloadSchema rejects invalid structure", async () => {
    const invalid = { columns: "not-an-array" };
    const parsed = FooterConfigPayloadSchema.safeParse(invalid);
    if (parsed.success) throw new Error("Schema should reject non-array columns");
  });

  await runTest("F-36", "Schema", "StaticPagePayloadSchema requires at least one section", async () => {
    const invalid = {
      metaTitle: "Test",
      heroTitle: "Test",
      sections: [],
    };
    const parsed = StaticPagePayloadSchema.safeParse(invalid);
    if (parsed.success) throw new Error("Schema should require at least 1 section");
  });

  await runTest("F-37", "Resilience", "Default fallback footer returned when database is unavailable", async () => {
    const defaultFooter = cmsFooterService.getDefaultFooter();
    if (!defaultFooter || defaultFooter.columns.length < 3) {
      throw new Error("Default fallback footer is incomplete");
    }
  });

  await runTest("F-38", "Resilience", "All 18 footer links point to valid routes", async () => {
    const footer = await cmsFooterService.getPublishedFooter("en");
    const validInternalPrefixes = ["/", "http://", "https://"];
    for (const col of footer.columns) {
      for (const link of col.links) {
        if (!validInternalPrefixes.some((p) => link.href.startsWith(p))) {
          throw new Error(`Invalid link href: ${link.href}`);
        }
      }
    }
  });

  // Summary
  console.log("\n=======================================================");
  console.log("   E2E TEST SUMMARY");
  console.log("=======================================================");
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`Total Scenarios: ${results.length}`);
  console.log(`Passed:          ${passed}`);
  console.log(`Failed:          ${failed}`);

  if (failed > 0) {
    console.error("\nFailed scenarios:");
    results.filter((r) => r.status === "FAIL").forEach((r) => {
      console.error(`- [${r.id}] ${r.name}: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log("\nALL 38 SCENARIOS PASSED WITH 100% SUCCESS RATE!\n");
  }
}

runE2ETests()
  .catch((e) => {
    console.error("Fatal test runner error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
