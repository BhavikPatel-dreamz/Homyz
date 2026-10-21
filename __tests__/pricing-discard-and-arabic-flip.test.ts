import fs from "fs";
import path from "path";
import { MESSAGES, SupportedLanguage, TranslationKey } from "../lib/i18n/language-context";
import { createTranslator } from "next-intl";

function runTests() {
  console.log("=====================================================================");
  console.log(" Test Suite: Pricing 'Discard Changes' Translations & Arabic Flip Fix");
  console.log("=====================================================================\n");

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, message: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ ${message}`);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  function logSection(title: string) {
    console.log(`\n--- ${title} ---`);
  }

  const supportedLangs: SupportedLanguage[] = ["en", "es", "fr", "de", "hi", "ar"];

  // -------------------------------------------------------------------------
  // 1. Verify New Pricing & Discard Keys Exist in All 6 Languages
  // -------------------------------------------------------------------------
  logSection("1. Key Existence & Non-Empty Across All 6 Locales");

  const newlyAddedKeys: TranslationKey[] = [
    "host_discard_changes",
    "host_editor_unsaved_desc",
    "host_editor_discard_leave",
    "host_guest_pays_per_night",
    "host_stay_length_discounts_desc",
    "host_cleaning_fee_accounting",
    "host_decrease_weekend_premium",
    "host_increase_weekend_premium",
  ];

  for (const key of newlyAddedKeys) {
    for (const lang of supportedLangs) {
      const val = MESSAGES[lang][key];
      assert(
        typeof val === "string" && val.trim().length > 0,
        `[${lang}] '${key}' exists and is non-empty ("${val}")`
      );
    }
  }

  // -------------------------------------------------------------------------
  // 2. Specific Translation Values for 'Discard changes' & 'Discard & leave'
  // -------------------------------------------------------------------------
  logSection("2. Discard Changes Translation Accuracies");

  const expectedDiscardTranslations: Record<SupportedLanguage, string> = {
    en: "Discard changes",
    es: "Descartar cambios",
    fr: "Ignorer les modifications",
    de: "Änderungen verwerfen",
    hi: "परिवर्तन छोड़ें",
    ar: "تراجع عن التغييرات",
  };

  for (const lang of supportedLangs) {
    assert(
      MESSAGES[lang].host_discard_changes === expectedDiscardTranslations[lang],
      `[${lang}] host_discard_changes matches: "${expectedDiscardTranslations[lang]}"`
    );
  }

  const expectedDiscardLeaveTranslations: Record<SupportedLanguage, string> = {
    en: "Discard & leave",
    es: "Descartar y salir",
    fr: "Ignorer et quitter",
    de: "Verwerfen & verlassen",
    hi: "छोड़ें और बाहर निकलें",
    ar: "تجاهل ومغادرة",
  };

  for (const lang of supportedLangs) {
    assert(
      MESSAGES[lang].host_editor_discard_leave === expectedDiscardLeaveTranslations[lang],
      `[${lang}] host_editor_discard_leave matches: "${expectedDiscardLeaveTranslations[lang]}"`
    );
  }

  // -------------------------------------------------------------------------
  // 3. Dynamic Placeholder Interpolation for 'host_guest_pays_per_night'
  // -------------------------------------------------------------------------
  logSection("3. Dynamic Interpolation for Guest Night Price");

  for (const lang of supportedLangs) {
    const translator = createTranslator({ locale: lang, messages: MESSAGES[lang] });
    const formattedAmount = "$120";
    const interpolated = translator("host_guest_pays_per_night", { amount: formattedAmount });

    assert(
      interpolated.includes(formattedAmount),
      `[${lang}] Interpolated guest price contains "${formattedAmount}": "${interpolated}"`
    );
  }

  // -------------------------------------------------------------------------
  // 4. Arabic Layout Flip Prevention Verification
  // -------------------------------------------------------------------------
  logSection("4. Arabic Layout Flip Prevention (LTR Consistency)");

  const langContextPath = path.resolve(__dirname, "../lib/i18n/language-context.tsx");
  const langContextCode = fs.readFileSync(langContextPath, "utf-8");

  // Ensure document.documentElement.dir is not dynamically flipped to "rtl"
  assert(
    !langContextCode.includes('dir = code === "ar" ? "rtl" : "ltr"'),
    "Old conditional RTL flip code (code === 'ar' ? 'rtl' : 'ltr') has been completely removed"
  );

  assert(
    langContextCode.includes('document.documentElement.dir = "ltr"'),
    "document.documentElement.dir is explicitly fixed to 'ltr' in LanguageProvider"
  );

  assert(
    langContextCode.includes('const dir = "ltr"'),
    "dir property in LanguageContext is fixed to 'ltr'"
  );

  assert(
    !langContextCode.includes('const dir = language === "ar" ? "rtl" : "ltr"'),
    "Old context dir conditional flip has been completely removed"
  );

  // -------------------------------------------------------------------------
  // 5. Source Code Verification: Hardcoded Strings Replaced in Components
  // -------------------------------------------------------------------------
  logSection("5. Pricing Component Translation Integration");

  const pricingComponentPath = path.resolve(
    __dirname,
    "../app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx"
  );
  const pricingCode = fs.readFileSync(pricingComponentPath, "utf-8");

  // Verify Discard Changes button uses t("host_discard_changes")
  assert(
    pricingCode.includes('{t("host_discard_changes", "Discard changes")}'),
    "PricingAndBookingViews uses t('host_discard_changes', 'Discard changes') for the button"
  );
  assert(
    !/>\s*Discard changes\s*<\/button>/.test(pricingCode),
    "No hardcoded 'Discard changes' button text remains in PricingAndBookingViews"
  );

  // Verify guest pays per night uses t("host_guest_pays_per_night", ...)
  assert(
    pricingCode.includes('t("host_guest_pays_per_night"'),
    "PricingAndBookingViews uses t('host_guest_pays_per_night') for discount previews"
  );

  // Verify stay length discounts description is translated
  assert(
    pricingCode.includes('t("host_stay_length_discounts_desc"'),
    "PricingAndBookingViews uses t('host_stay_length_discounts_desc') for discount description"
  );

  // Verify cleaning fee accounting note is translated
  assert(
    pricingCode.includes('t("host_cleaning_fee_accounting"'),
    "PricingAndBookingViews uses t('host_cleaning_fee_accounting') for cleaning fee accounting note"
  );

  // Verify editor client unsaved modal translations
  const editorClientPath = path.resolve(
    __dirname,
    "../app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"
  );
  const editorCode = fs.readFileSync(editorClientPath, "utf-8");

  assert(
    editorCode.includes('{t("host_editor_discard_leave", "Discard & leave")}'),
    "HostListingEditorClient uses t('host_editor_discard_leave') for discard button"
  );
  assert(
    editorCode.includes('{t("host_editor_unsaved_desc"'),
    "HostListingEditorClient uses t('host_editor_unsaved_desc') for dialog message"
  );

  // -------------------------------------------------------------------------
  // 6. Complete Dictionary Key Parity Across All 6 Locales
  // -------------------------------------------------------------------------
  logSection("6. Exact 100% Locale Dictionary Key Parity");

  const enKeys = Object.keys(MESSAGES.en);
  for (const lang of supportedLangs) {
    const targetKeys = Object.keys(MESSAGES[lang]);
    assert(
      targetKeys.length === enKeys.length,
      `[${lang}] Total key count matches English (${targetKeys.length} / ${enKeys.length})`
    );
  }

  console.log(`\n=====================================================================`);
  console.log(`🎉 SUCCESS: All ${passedCount}/${totalCount} tests passed cleanly!`);
  console.log(`=====================================================================\n`);
}

runTests();
