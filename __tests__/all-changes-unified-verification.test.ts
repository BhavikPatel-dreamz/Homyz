import fs from "fs";
import path from "path";
import { MESSAGES, SupportedLanguage, TranslationKey } from "../lib/i18n/language-context";
import { createTranslator } from "next-intl";

function runAllChangesMasterTestSuite() {
  console.log("==========================================================================================");
  console.log(" MASTER VERIFICATION TEST SUITE: ALL RECENT CHANGES & LOCALIZATION EXPANSIONS");
  console.log(" Covers: Wizard Flow, Regulations Page, About Host Page, Pricing View & Arabic Layout Fix");
  console.log("==========================================================================================\n");

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, message: string, forceLog = true) {
    totalCount++;
    if (condition) {
      passedCount++;
      if (forceLog) {
        console.log(`  ✓ ${message}`);
      }
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  function logSection(title: string) {
    console.log(`\n==========================================================================================`);
    console.log(` ${title}`);
    console.log(`==========================================================================================`);
  }

  const supportedLangs: SupportedLanguage[] = ["en", "es", "fr", "de", "hi", "ar"];

  // =========================================================================
  // SECTION 1: GLOBAL 1:1 LOCALE PARITY & DICTIONARY INTEGRITY
  // =========================================================================
  logSection("SECTION 1: Global 1:1 Locale Parity Across All 6 Locales");

  const enKeys = Object.keys(MESSAGES.en) as TranslationKey[];
  assert(enKeys.length >= 4970, `English dictionary key count is at least 4,970 (found: ${enKeys.length})`);

  for (const lang of supportedLangs) {
    const targetKeys = Object.keys(MESSAGES[lang]);
    assert(
      targetKeys.length === enKeys.length,
      `[${lang}] Key count exactly equals English (${enKeys.length} / ${enKeys.length})`
    );

    // Forward check: all en keys exist in target locale
    for (const key of enKeys) {
      assert(key in MESSAGES[lang], `[${lang}] Missing key: '${key}'`, false);
    }

    // Reverse check: no extra keys in target locale
    for (const key of targetKeys) {
      assert(key in MESSAGES.en, `[${lang}] Extra unexpected key: '${key}'`, false);
    }

    // Non-empty trimmed string check
    for (const key of enKeys) {
      const val = MESSAGES[lang][key];
      assert(
        typeof val === "string" && val.trim().length > 0,
        `[${lang}] '${key}' is a non-empty string`,
        false
      );
    }
    console.log(`  ✓ [${lang}] All 4,970 keys verified symmetrical, 100% non-empty and trimmed`);
  }

  // =========================================================================
  // SECTION 2: NEW LISTING CREATION FLOW (/host/listings/new)
  // =========================================================================
  logSection("SECTION 2: New Listing Creation Wizard Flow Translations");

  const wizardKeys: TranslationKey[] = [
    "host_booking_settings_pick_title",
    "host_booking_settings_change_anytime",
    "host_booking_mode_request_title",
    "host_booking_mode_request_desc",
    "host_booking_mode_instant_title",
    "host_booking_mode_instant_desc",
    "host_license_step_title",
    "host_license_step_desc",
    "host_license_preview_badge",
    "host_license_whats_next_title",
    "host_license_next_calendar_title",
    "host_license_next_calendar_desc",
    "host_license_next_settings_title",
    "host_license_next_settings_desc",
    "host_license_next_prepare_title",
    "host_license_next_prepare_desc",
    "host_license_verify_section_title",
    "host_license_verify_section_desc",
    "host_license_saudi_number_label",
    "host_license_saudi_placeholder",
    "host_license_btn_verify",
    "host_license_status_verified",
    "host_license_manual_section_title",
    "host_license_btn_save_publish",
    "host_license_btn_save_submit",
    "wizard_req_street_address",
    "wizard_req_city",
    "wizard_req_country",
    "wizard_photos_err_invalid",
    "wizard_photos_err_upload",
  ];

  for (const key of wizardKeys) {
    for (const lang of supportedLangs) {
      const val = MESSAGES[lang][key];
      assert(
        typeof val === "string" && val.trim().length > 0,
        `[${lang}] Wizard key '${key}' verified: "${val.slice(0, 40)}..."`
      );
    }
  }

  // Source code verification for wizard components
  const wizardComponents = [
    {
      file: "components/host/onboarding/step-license-approval.tsx",
      expectedStrings: ["host_license_step_title", "host_license_whats_next_title", "Edit registration details"],
    },
    {
      file: "components/host/onboarding/step-registration-details.tsx",
      expectedStrings: ["Add registration details", "National identification number", "Continue"],
    },
    {
      file: "components/host/onboarding/step-booking-settings.tsx",
      expectedStrings: ["host_booking_mode_request_title", "host_booking_mode_instant_title"],
    },
    {
      file: "components/host/new-listing-get-started.tsx",
      expectedStrings: ["wizard_req_street_address", "wizard_req_city", "wizard_req_country"],
    },
    {
      file: "components/host/onboarding/onboarding-header.tsx",
      expectedStrings: ["host_header_questions"],
    },
  ];

  for (const comp of wizardComponents) {
    const compPath = path.resolve(__dirname, "..", comp.file);
    const code = fs.readFileSync(compPath, "utf-8");
    for (const str of comp.expectedStrings) {
      assert(code.includes(str), `${comp.file} references translation key '${str}'`);
    }
  }

  // =========================================================================
  // SECTION 3: EDIT LISTING REGULATIONS PAGE (/host/listings/[id]/regulations)
  // =========================================================================
  logSection("SECTION 3: Regulations & License View Translations");

  const regulationKeys: TranslationKey[] = [
    "host_license_property_regulations",
    "host_license_details_title",
    "host_license_readonly_notice",
    "host_license_official_details_title",
    "host_license_official_details_desc",
    "host_license_detail_category",
    "host_license_detail_country",
    "host_license_country_saudi",
    "host_license_detail_facility",
    "host_license_detail_entity",
    "host_license_detail_official_status",
    "host_license_detail_eligibility",
    "host_license_detail_issue_date",
    "host_license_detail_expiry_date",
    "host_license_detail_source",
    "host_license_detail_approval_method",
    "host_license_approval_auto",
    "host_license_approval_manual",
    "host_license_linked_properties_title",
    "host_license_history_title",
    "host_license_btn_reverify",
    "host_license_btn_save",
  ];

  for (const key of regulationKeys) {
    for (const lang of supportedLangs) {
      const val = MESSAGES[lang][key];
      assert(
        typeof val === "string" && val.trim().length > 0,
        `[${lang}] Regulation key '${key}' verified: "${val.slice(0, 40)}..."`
      );
    }
  }

  // Source code check for LicenseRegulationsView.tsx
  const licenseRegulationsPath = path.resolve(
    __dirname,
    "../app/(protected)/host/listings/[id]/components/LicenseRegulationsView.tsx"
  );
  const licenseRegCode = fs.readFileSync(licenseRegulationsPath, "utf-8");
  assert(
    licenseRegCode.includes('t("host_license_property_regulations"'),
    "LicenseRegulationsView uses t('host_license_property_regulations')"
  );
  assert(
    licenseRegCode.includes('t("host_license_official_details_title"'),
    "LicenseRegulationsView uses t('host_license_official_details_title')"
  );
  assert(
    licenseRegCode.includes('t("host_license_btn_reverify"'),
    "LicenseRegulationsView uses t('host_license_btn_reverify')"
  );

  // =========================================================================
  // SECTION 4: EDIT LISTING ABOUT HOST PAGE (/host/listings/[id]/about-host)
  // =========================================================================
  logSection("SECTION 4: About Host View & Interests Translations");

  const aboutHostKeys: TranslationKey[] = [
    "host_about_view_profile",
    "host_about_edit_profile",
    "host_about_superhost",
    "host_about_stat_reviews",
    "host_about_stat_rating",
    "host_about_stat_years_hosting",
    "host_about_key_work",
    "host_about_key_languages",
    "host_about_key_live",
    "host_about_reviews_title",
    "host_about_ask_about_title",
    "host_about_listings_title",
    "host_about_intro_trust_desc",
    "host_about_me_title",
    "host_about_edit_intro",
    "host_about_edit_interests",
    "host_about_save_button",
    "host_about_modal_intro_title",
    "host_about_modal_interests_title",
  ];

  for (const key of aboutHostKeys) {
    for (const lang of supportedLangs) {
      const val = MESSAGES[lang][key];
      assert(
        typeof val === "string" && val.trim().length > 0,
        `[${lang}] About Host key '${key}' verified: "${val.slice(0, 40)}..."`
      );
    }
  }

  // Verify interest tags (all 27 interests)
  const interestKeys: TranslationKey[] = [
    "interest_films", "interest_food_scenes", "interest_shopping", "interest_swimming",
    "interest_outdoors", "interest_live_music", "interest_photography", "interest_coffee",
    "interest_cooking", "interest_local_culture", "interest_walking", "interest_animals",
    "interest_reading", "interest_hiking", "interest_wine", "interest_fitness",
    "interest_art", "interest_architecture", "interest_nature", "interest_sports",
    "interest_travel", "interest_history", "interest_gaming", "interest_yoga",
    "interest_live_sports", "interest_museums", "interest_video_games"
  ];

  for (const interestKey of interestKeys) {
    for (const lang of supportedLangs) {
      assert(
        typeof MESSAGES[lang][interestKey] === "string" && MESSAGES[lang][interestKey].length > 0,
        `[${lang}] Interest key '${interestKey}' localized`
      );
    }
  }

  // Source code check for HostAboutHostView.tsx
  const hostAboutPath = path.resolve(
    __dirname,
    "../app/(protected)/host/listings/[id]/components/HostAboutHostView.tsx"
  );
  const hostAboutCode = fs.readFileSync(hostAboutPath, "utf-8");
  assert(
    hostAboutCode.includes('t("host_about_edit_profile"'),
    "HostAboutHostView uses t('host_about_edit_profile')"
  );
  assert(
    hostAboutCode.includes('t("host_about_superhost"'),
    "HostAboutHostView uses t('host_about_superhost')"
  );
  assert(
    hostAboutCode.includes('t("host_about_save_button"'),
    "HostAboutHostView uses t('host_about_save_button')"
  );

  // =========================================================================
  // SECTION 5: PRICING VIEW DISCARD CHANGES & UNEXPECTED DIALOG MODAL
  // =========================================================================
  logSection("SECTION 5: Pricing View Discard Changes & Modal Translations");

  const pricingKeys: TranslationKey[] = [
    "host_discard_changes",
    "host_editor_unsaved_desc",
    "host_editor_discard_leave",
    "host_guest_pays_per_night",
    "host_stay_length_discounts_desc",
    "host_cleaning_fee_accounting",
    "host_decrease_weekend_premium",
    "host_increase_weekend_premium",
  ];

  for (const key of pricingKeys) {
    for (const lang of supportedLangs) {
      const val = MESSAGES[lang][key];
      assert(
        typeof val === "string" && val.trim().length > 0,
        `[${lang}] Pricing key '${key}' verified: "${val}"`
      );
    }
  }

  // Verify Discard Changes across locales
  const discardTranslations: Record<SupportedLanguage, string> = {
    en: "Discard changes",
    es: "Descartar cambios",
    fr: "Ignorer les modifications",
    de: "Änderungen verwerfen",
    hi: "परिवर्तन छोड़ें",
    ar: "تراجع عن التغييرات",
  };
  for (const lang of supportedLangs) {
    assert(
      MESSAGES[lang].host_discard_changes === discardTranslations[lang],
      `[${lang}] host_discard_changes correctly translated to "${discardTranslations[lang]}"`
    );
  }

  // Source code check for PricingAndBookingViews.tsx and host-listing-editor-client.tsx
  const pricingViewPath = path.resolve(
    __dirname,
    "../app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx"
  );
  const pricingCode = fs.readFileSync(pricingViewPath, "utf-8");
  assert(
    pricingCode.includes('{t("host_discard_changes", "Discard changes")}'),
    "PricingAndBookingViews uses t('host_discard_changes', 'Discard changes')"
  );
  assert(
    !/>\s*Discard changes\s*<\/button>/.test(pricingCode),
    "No hardcoded 'Discard changes' button text in PricingAndBookingViews"
  );

  const editorClientPath = path.resolve(
    __dirname,
    "../app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"
  );
  const editorCode = fs.readFileSync(editorClientPath, "utf-8");
  assert(
    editorCode.includes('{t("host_editor_discard_leave", "Discard & leave")}'),
    "host-listing-editor-client uses t('host_editor_discard_leave', 'Discard & leave')"
  );
  assert(
    editorCode.includes('{t("host_editor_unsaved_desc"'),
    "host-listing-editor-client uses t('host_editor_unsaved_desc')"
  );

  // =========================================================================
  // SECTION 6: DYNAMIC PLACEHOLDER INTERPOLATION
  // =========================================================================
  logSection("SECTION 6: Dynamic Runtime Translator Placeholder Interpolations");

  for (const lang of supportedLangs) {
    const translator = createTranslator({ locale: lang, messages: MESSAGES[lang] });
    const amountVal = "150 SAR";
    const res = translator("host_guest_pays_per_night", { amount: amountVal });
    assert(
      res.includes(amountVal),
      `[${lang}] Interpolated 'host_guest_pays_per_night' contains '${amountVal}': "${res}"`
    );
  }

  // =========================================================================
  // SECTION 7: ARABIC FULL WEBSITE FLIP RESOLUTION (LTR INTEGRITY)
  // =========================================================================
  logSection("SECTION 7: Arabic Website Flip Resolution (Layout LTR Preservation)");

  const langContextPath = path.resolve(__dirname, "../lib/i18n/language-context.tsx");
  const langContextCode = fs.readFileSync(langContextPath, "utf-8");

  assert(
    !langContextCode.includes('code === "ar" ? "rtl" : "ltr"'),
    "Conditional RTL flip on Arabic selection is removed from language-context.tsx"
  );
  assert(
    langContextCode.includes('document.documentElement.dir = "ltr"'),
    "document.documentElement.dir is explicitly fixed to 'ltr'"
  );
  assert(
    langContextCode.includes('const dir = "ltr"'),
    "Context dir is fixed to 'ltr' so UI components maintain standard layout"
  );
  assert(
    langContextCode.includes('document.documentElement.lang = code'),
    "document.documentElement.lang is dynamically set to selected language code (including 'ar')"
  );

  console.log(`\n==========================================================================================`);
  console.log(`🎉 ALL TESTS PASSED SUCCESSFULLY! Total Assertions: ${passedCount}/${totalCount}`);
  console.log(`==========================================================================================\n`);
}

runAllChangesMasterTestSuite();
