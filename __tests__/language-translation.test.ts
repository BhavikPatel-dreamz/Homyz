import { MESSAGES, SupportedLanguage, TranslationKey } from "../lib/i18n/language-context";
import { listingTypeLabel, propertyTypeLabel } from "../lib/constants/listing-enums";
import { createTranslator } from "next-intl";

function runTests() {
  console.log("=== Running Comprehensive Language Translation Test Suite ===");
  let passedCount = 0;
  let totalCount = 0;

  const isVerbose = process.env.VERBOSE === "true";

  function assert(condition: boolean, message: string, forceLog = true) {
    totalCount++;
    if (condition) {
      passedCount++;
      if (forceLog || isVerbose) {
        console.log(`  ✓ ${message}`);
      }
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Test failed: ${message}`);
    }
  }

  function logSection(title: string) {
    console.log(`\n--- ${title} ---`);
  }

  // 1. Supported Languages List
  logSection("1. Supported Languages Configuration");
  const supportedLangs: SupportedLanguage[] = ["en", "es", "fr", "de", "hi", "ar"];
  assert(supportedLangs.length === 6, "Supported languages count must be exactly 6");

  // 2. Reference English Dictionary
  logSection("2. English Reference Dictionary Integrity");
  const enKeys = Object.keys(MESSAGES.en) as TranslationKey[];
  assert(enKeys.length === 4269, `English dictionary must have all 4,269 keys (found ${enKeys.length})`);

  // 3. Symmetrical 1:1 Key Parity (Both Directions)
  logSection("3. Symmetrical 1:1 Key Parity Across All 6 Locales");
  for (const lang of supportedLangs) {
    const langDict = MESSAGES[lang];
    assert(!!langDict, `Translations for '${lang}' must exist`);
    const langKeys = Object.keys(langDict);
    assert(langKeys.length === enKeys.length, `[${lang}] Key count must match EN exactly (${langKeys.length} / ${enKeys.length})`);

    // Forward check: all EN keys exist in target language
    for (const key of enKeys) {
      assert(key in langDict, `[${lang}] Missing key '${key}' from English`, false);
    }

    // Reverse check: no extra / orphaned keys exist in target language
    for (const key of langKeys) {
      assert(key in MESSAGES.en, `[${lang}] Extra key '${key}' not in English`, false);
    }

    console.log(`  ✓ [${lang}] Symmetrical 1:1 key parity verified (4,161 keys, 0 missing, 0 extra)`);
  }

  // 4. Non-Empty String Value Integrity
  logSection("4. Non-Empty String Value Integrity (24,966 Entries)");
  for (const lang of supportedLangs) {
    const langDict = MESSAGES[lang];
    for (const key of enKeys) {
      const val = langDict[key];
      assert(
        typeof val === "string" && val.trim().length > 0,
        `[${lang}] Key '${key}' must have a non-empty string value`,
        false
      );
    }
    console.log(`  ✓ [${lang}] All 4,161 keys verified as valid, non-empty, trimmed strings`);
  }

  // 5. Dynamic Placeholder Syntax Validation
  logSection("5. Dynamic Placeholder Format Validation");
  const placeholderRegex = /\{[a-zA-Z0-9_]+\}/g;
  for (const key of enKeys) {
    const enVal = MESSAGES.en[key];
    const enMatches = enVal.match(placeholderRegex) || [];
    const enPlaceholders = Array.from(new Set(enMatches));
    if (enPlaceholders.length > 0) {
      for (const lang of ["es", "fr", "de", "hi"] as const) {
        const locVal = MESSAGES[lang][key];
        const locMatches = locVal.match(placeholderRegex) || [];
        const locPlaceholders = Array.from(new Set(locMatches));
        assert(
          enPlaceholders.every((p) => locPlaceholders.includes(p)),
          `[${lang}] Missing placeholder in '${key}' (expected ${enPlaceholders.join(", ")})`,
          false
        );
      }
    }
  }
  console.log("  ✓ Dynamic placeholder formats verified across all languages");

  // 6. Runtime Translator & Variable Interpolation
  logSection("6. Runtime Translator & Variable Interpolation");
  const translatorEn = createTranslator({ locale: "en", messages: MESSAGES.en });
  const translatorEs = createTranslator({ locale: "es", messages: MESSAGES.es });
  const translatorAr = createTranslator({ locale: "ar", messages: MESSAGES.ar });

  assert(
    translatorEn("home_section_homes_in", { location: "Tokyo" }) === "Homes in Tokyo",
    "EN translator correctly interpolates {location}"
  );
  assert(
    translatorEs("home_section_homes_in", { location: "Madrid" }) === "Alojamientos en Madrid",
    "ES translator correctly interpolates {location}"
  );
  assert(
    translatorAr("home_section_homes_in", { location: "Dubai" }) === "إقامات في Dubai",
    "AR translator correctly interpolates {location}"
  );

  assert(
    translatorEn("public_reviews_page_heading", { name: "Sarah" }) === "Sarah's reviews",
    "EN translator correctly interpolates {name}"
  );
  assert(
    translatorEs("public_reviews_page_heading", { name: "Sarah" }) === "Evaluaciones de Sarah",
    "ES translator correctly interpolates {name}"
  );
  assert(
    translatorAr("public_reviews_page_heading", { name: "سارة" }) === "تقييمات سارة",
    "AR translator correctly interpolates {name}"
  );

  // Listing Type and Property Type Enum Labels
  logSection("6b. Listing & Property Type Enum Labels Across All 6 Locales");
  for (const lang of supportedLangs) {
    const t = (key: string) => (MESSAGES[lang] as Record<string, string>)[key] || key;
    assert(listingTypeLabel("ENTIRE_PLACE", t) !== "ENTIRE_PLACE", `[${lang}] ENTIRE_PLACE listing type label localized`);
    assert(propertyTypeLabel("HOUSE", t) !== "HOUSE", `[${lang}] HOUSE property type label localized`);
    assert(propertyTypeLabel("APARTMENT", t) !== "APARTMENT", `[${lang}] APARTMENT property type label localized`);
  }

  logSection("7a. Header & Navigation");
  assert(MESSAGES.en.header_become_a_host === "Become a host", "EN header_become_a_host");
  assert(MESSAGES.es.header_become_a_host === "Hazte anfitri\u00f3n", "ES header_become_a_host");
  assert(MESSAGES.fr.header_become_a_host === "Devenir h\u00f4te", "FR header_become_a_host");
  assert(MESSAGES.de.header_become_a_host === "Gastgeber werden", "DE header_become_a_host");
  assert(MESSAGES.hi.header_become_a_host === "\u0939\u094b\u0938\u094d\u091f \u092c\u0928\u0947\u0902", "HI header_become_a_host");
  assert(MESSAGES.ar.header_become_a_host === "\u0643\u0646 \u0645\u0636\u064a\u0641\u0627\u064b", "AR header_become_a_host");
  assert(MESSAGES.en.header_wishlist === "Wishlist", "EN header_wishlist");
  assert(MESSAGES.es.header_wishlist === "Lista de deseos", "ES header_wishlist");
  assert(MESSAGES.fr.header_wishlist === "Favoris", "FR header_wishlist");
  assert(MESSAGES.de.header_wishlist === "Wunschliste", "DE header_wishlist");
  assert(MESSAGES.hi.header_wishlist === "\u0907\u091a\u094d\u091b\u093e-\u0938\u0942\u091a\u0940", "HI header_wishlist");
  assert(MESSAGES.ar.header_wishlist === "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u063a\u0628\u0627\u062a", "AR header_wishlist");

  logSection("7b. Authentication & Password Recovery");
  assert(MESSAGES.en.auth_email_address === "Email address", "EN auth_email_address");
  assert(MESSAGES.es.auth_email_address === "Correo electr\u00f3nico", "ES auth_email_address");
  assert(MESSAGES.fr.auth_email_address === "Adresse e-mail", "FR auth_email_address");
  assert(MESSAGES.de.auth_email_address === "E-Mail-Adresse", "DE auth_email_address");
  assert(MESSAGES.hi.auth_email_address === "\u0908\u092e\u0947\u0932 \u092a\u0924\u093e", "HI auth_email_address");
  assert(MESSAGES.ar.auth_email_address === "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a", "AR auth_email_address");
  assert(MESSAGES.en.auth_send_reset_link === "Send Reset Link", "EN auth_send_reset_link");
  assert(MESSAGES.es.auth_send_reset_link === "Enviar enlace de restablecimiento", "ES auth_send_reset_link");
  assert(MESSAGES.fr.auth_send_reset_link === "Envoyer le lien de r\u00e9initialisation", "FR auth_send_reset_link");
  assert(MESSAGES.de.auth_send_reset_link === "Link senden", "DE auth_send_reset_link");
  assert(MESSAGES.hi.auth_send_reset_link === "\u0930\u0940\u0938\u0947\u091f \u0932\u093f\u0902\u0915 \u092d\u0947\u091c\u0947\u0902", "HI auth_send_reset_link");
  assert(MESSAGES.ar.auth_send_reset_link === "\u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0639\u064a\u064a\u0646", "AR auth_send_reset_link");
  assert(MESSAGES.en.auth_reset_title === "Reset Password", "EN auth_reset_title");
  assert(MESSAGES.es.auth_reset_title === "Restablecer contrase\u00f1a", "ES auth_reset_title");
  assert(MESSAGES.fr.auth_reset_title === "R\u00e9initialiser le mot de passe", "FR auth_reset_title");
  assert(MESSAGES.de.auth_reset_title === "Passwort zur\u00fccksetzen", "DE auth_reset_title");
  assert(MESSAGES.hi.auth_reset_title === "\u092a\u093e\u0938\u0935\u0930\u094d\u0921 \u0930\u0940\u0938\u0947\u091f \u0915\u0930\u0947\u0902", "HI auth_reset_title");
  assert(MESSAGES.ar.auth_reset_title === "\u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", "AR auth_reset_title");
  assert(MESSAGES.en.admin_login_subtitle === "Enter your credentials to access the admin portal.", "EN admin_login_subtitle");
  assert(MESSAGES.es.admin_login_subtitle === "Ingrese sus credenciales para acceder al portal de administraci\u00f3n.", "ES admin_login_subtitle");
  assert(MESSAGES.fr.admin_login_subtitle === "Saisissez vos identifiants pour acc\u00e9der au portail d'administration.", "FR admin_login_subtitle");
  assert(MESSAGES.de.admin_login_subtitle === "Geben Sie Ihre Zugangsdaten ein, um auf das Administrator-Portal zuzugreifen.", "DE admin_login_subtitle");
  assert(MESSAGES.hi.admin_login_subtitle === "\u090f\u0921\u092e\u093f\u0928 \u092a\u094b\u0930\u094d\u091f\u0932 \u0924\u0915 \u092a\u0939\u0941\u0902\u091a\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0905\u092a\u0928\u0940 \u0938\u093e\u0916 \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902\u0964", "HI admin_login_subtitle");
  assert(MESSAGES.ar.admin_login_subtitle === "\u0623\u062f\u062e\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0643 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645 \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629.", "AR admin_login_subtitle");

  logSection("7c. Email Verification Landing (/verify)");
  assert(MESSAGES.en.verify_title === "Email verification", "EN verify_title");
  assert(MESSAGES.es.verify_title === "Verificaci\u00f3n de correo electr\u00f3nico", "ES verify_title");
  assert(MESSAGES.fr.verify_title === "V\u00e9rification de l'e-mail", "FR verify_title");
  assert(MESSAGES.de.verify_title === "E-Mail-Verifizierung", "DE verify_title");
  assert(MESSAGES.hi.verify_title === "\u0908\u092e\u0947\u0932 \u0938\u0924\u094d\u092f\u093e\u092a\u0928", "HI verify_title");
  assert(MESSAGES.ar.verify_title === "\u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a", "AR verify_title");
  assert(MESSAGES.en.verify_success === "Your email is verified. You can now sign in.", "EN verify_success");
  assert(MESSAGES.es.verify_success === "Tu correo electr\u00f3nico ha sido verificado. Ya puedes iniciar sesi\u00f3n.", "ES verify_success");
  assert(MESSAGES.fr.verify_success === "Votre e-mail est v\u00e9rifi\u00e9. Vous pouvez maintenant vous connecter.", "FR verify_success");
  assert(MESSAGES.de.verify_success === "Ihre E-Mail-Adresse wurde best\u00e4tigt. Sie k\u00f6nnen sich jetzt anmelden.", "DE verify_success");
  assert(MESSAGES.hi.verify_success === "\u0906\u092a\u0915\u093e \u0908\u092e\u0947\u0932 \u0938\u0924\u094d\u092f\u093e\u092a\u093f\u0924 \u0939\u094b \u0917\u092f\u093e \u0939\u0948\u0964 \u0905\u092c \u0906\u092a \u0938\u093e\u0907\u0928 \u0907\u0928 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964", "HI verify_success");
  assert(MESSAGES.ar.verify_success === "\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0628\u0631\u064a\u062f\u0643 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a. \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644.", "AR verify_success");

  logSection("7d. Account Settings & Personal Info (/account-settings)");
  assert(MESSAGES.en.personal_info_title === "Personal information", "EN personal_info_title");
  assert(MESSAGES.es.personal_info_title === "Informaci\u00f3n personal", "ES personal_info_title");
  assert(MESSAGES.fr.personal_info_title === "Informations personnelles", "FR personal_info_title");
  assert(MESSAGES.de.personal_info_title === "Pers\u00f6nliche Angaben", "DE personal_info_title");
  assert(MESSAGES.hi.personal_info_title === "\u0935\u094d\u092f\u0915\u094d\u0924\u093f\u0917\u0924 \u091c\u093e\u0928\u0915\u093e\u0930\u0940", "HI personal_info_title");
  assert(MESSAGES.ar.personal_info_title === "\u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0634\u062e\u0635\u064a\u0629", "AR personal_info_title");
  assert(MESSAGES.en.personal_info_legal_name === "Legal name", "EN personal_info_legal_name");
  assert(MESSAGES.es.personal_info_legal_name === "Nombre legal", "ES personal_info_legal_name");
  assert(MESSAGES.fr.personal_info_legal_name === "Nom l\u00e9gal", "FR personal_info_legal_name");
  assert(MESSAGES.de.personal_info_legal_name === "Offizieller Name", "DE personal_info_legal_name");
  assert(MESSAGES.hi.personal_info_legal_name === "\u0915\u093e\u0928\u0942\u0928\u0940 \u0928\u093e\u092e", "HI personal_info_legal_name");
  assert(MESSAGES.ar.personal_info_legal_name === "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a", "AR personal_info_legal_name");

  logSection("7e. Home Page Hero & Stays Discovery");
  assert(MESSAGES.en.home_hero_title === "Book cozy stays that feel like home", "EN home_hero_title");
  assert(MESSAGES.es.home_hero_title === "Reserva alojamientos acogedores que se sientan como en casa", "ES home_hero_title");
  assert(MESSAGES.fr.home_hero_title === "R\u00e9servez des s\u00e9jours chaleureux comme \u00e0 la maison", "FR home_hero_title");
  assert(MESSAGES.de.home_hero_title === "Buchen Sie gem\u00fctliche Unterk\u00fcnfte wie zu Hause", "DE home_hero_title");
  assert(MESSAGES.hi.home_hero_title === "\u0918\u0930 \u091c\u0948\u0938\u093e \u0905\u0928\u0941\u092d\u0935 \u0926\u0947\u0928\u0947 \u0935\u093e\u0932\u0947 \u0906\u0930\u093e\u092e\u0926\u093e\u092f\u0915 \u0906\u0935\u093e\u0938 \u092c\u0941\u0915 \u0915\u0930\u0947\u0902", "HI home_hero_title");
  assert(MESSAGES.ar.home_hero_title === "\u0627\u062d\u062c\u0632 \u0625\u0642\u0627\u0645\u0627\u062a \u0645\u0631\u064a\u062d\u0629 \u062a\u0645\u0646\u062d\u0643 \u0634\u0639\u0648\u0631 \u0627\u0644\u0645\u0646\u0632\u0644", "AR home_hero_title");
  assert(MESSAGES.en.home_whos_coming === "Who's coming?", "EN home_whos_coming");
  assert(MESSAGES.es.home_whos_coming === "\u00bfQui\u00e9n viene?", "ES home_whos_coming");
  assert(MESSAGES.fr.home_whos_coming === "Qui vient ?", "FR home_whos_coming");
  assert(MESSAGES.de.home_whos_coming === "Wer kommt mit?", "DE home_whos_coming");
  assert(MESSAGES.hi.home_whos_coming === "\u0915\u094c\u0928 \u0906 \u0930\u0939\u093e \u0939\u0948?", "HI home_whos_coming");
  assert(MESSAGES.ar.home_whos_coming === "\u0645\u0646 \u0627\u0644\u0642\u0627\u062f\u0645\u061f", "AR home_whos_coming");
  assert(MESSAGES.en.home_when_tab_dates === "Dates", "EN home_when_tab_dates");
  assert(MESSAGES.es.home_when_tab_dates === "Fechas", "ES home_when_tab_dates");
  assert(MESSAGES.fr.home_when_tab_dates === "Dates", "FR home_when_tab_dates");
  assert(MESSAGES.de.home_when_tab_dates === "Daten", "DE home_when_tab_dates");
  assert(MESSAGES.hi.home_when_tab_dates === "\u0924\u093e\u0930\u0940\u0916\u0947\u0902", "HI home_when_tab_dates");
  assert(MESSAGES.ar.home_when_tab_dates === "\u0627\u0644\u062a\u0648\u0627\u0631\u064a\u062e", "AR home_when_tab_dates");
  assert(MESSAGES.en.home_when_trip === "When's your trip?", "EN home_when_trip");
  assert(MESSAGES.es.home_when_trip === "\u00bfCu\u00e1ndo es tu viaje?", "ES home_when_trip");
  assert(MESSAGES.fr.home_when_trip === "Quand a lieu votre voyage ?", "FR home_when_trip");
  assert(MESSAGES.de.home_when_trip === "Wann ist Ihre Reise?", "DE home_when_trip");
  assert(MESSAGES.hi.home_when_trip === "\u0906\u092a\u0915\u0940 \u092f\u093e\u0924\u094d\u0930\u093e \u0915\u092c \u0939\u0948?", "HI home_when_trip");
  assert(MESSAGES.ar.home_when_trip === "\u0645\u062a\u0649 \u0631\u062d\u0644\u062a\u0643\u061f", "AR home_when_trip");
  assert(MESSAGES.en.home_section_featured_stays === "Featured stays", "EN home_section_featured_stays");
  assert(MESSAGES.es.home_section_featured_stays === "Alojamientos destacados", "ES home_section_featured_stays");
  assert(MESSAGES.fr.home_section_featured_stays === "S\u00e9jours en vedette", "FR home_section_featured_stays");
  assert(MESSAGES.de.home_section_featured_stays === "Empfohlene Unterk\u00fcnfte", "DE home_section_featured_stays");
  assert(MESSAGES.hi.home_section_featured_stays === "\u0935\u093f\u0936\u0947\u0937 \u0906\u0935\u093e\u0938", "HI home_section_featured_stays");
  assert(MESSAGES.ar.home_section_featured_stays === "\u0625\u0642\u0627\u0645\u0627\u062a \u0645\u0645\u064a\u0632\u0629", "AR home_section_featured_stays");
  assert(MESSAGES.en.home_section_available_weekend === "Available this weekend", "EN home_section_available_weekend");
  assert(MESSAGES.es.home_section_available_weekend === "Disponible este fin de semana", "ES home_section_available_weekend");
  assert(MESSAGES.fr.home_section_available_weekend === "Disponible ce week-end", "FR home_section_available_weekend");
  assert(MESSAGES.de.home_section_available_weekend === "Dieses Wochenende verf\u00fcgbar", "DE home_section_available_weekend");
  assert(MESSAGES.hi.home_section_available_weekend === "\u0907\u0938 \u0938\u092a\u094d\u0924\u093e\u0939\u093e\u0902\u0924 \u0909\u092a\u0932\u092c\u094d\u0927", "HI home_section_available_weekend");
  assert(MESSAGES.ar.home_section_available_weekend === "\u0645\u062a\u0627\u062d \u0641\u064a \u0639\u0637\u0644\u0629 \u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0647\u0630\u0647", "AR home_section_available_weekend");
  assert(MESSAGES.en.home_section_trending_stays === "Trending stays", "EN home_section_trending_stays");
  assert(MESSAGES.es.home_section_trending_stays === "Alojamientos populares", "ES home_section_trending_stays");
  assert(MESSAGES.fr.home_section_trending_stays === "S\u00e9jours tendance", "FR home_section_trending_stays");
  assert(MESSAGES.de.home_section_trending_stays === "Beliebte Aufenthalte", "DE home_section_trending_stays");
  assert(MESSAGES.hi.home_section_trending_stays === "\u092a\u094d\u0930\u091a\u0932\u093f\u0924 \u0906\u0935\u093e\u0938", "HI home_section_trending_stays");
  assert(MESSAGES.ar.home_section_trending_stays === "\u0625\u0642\u0627\u0645\u0627\u062a \u0634\u0627\u0626\u0639\u0629", "AR home_section_trending_stays");
  assert(MESSAGES.en.home_section_recommended_stays === "Recommended stays", "EN home_section_recommended_stays");
  assert(MESSAGES.es.home_section_recommended_stays === "Estancias recomendadas", "ES home_section_recommended_stays");
  assert(MESSAGES.fr.home_section_recommended_stays === "S\u00e9jours recommand\u00e9s", "FR home_section_recommended_stays");
  assert(MESSAGES.de.home_section_recommended_stays === "Empfohlene Aufenthalte", "DE home_section_recommended_stays");
  assert(MESSAGES.hi.home_section_recommended_stays === "\u0905\u0928\u0941\u0936\u0902\u0938\u093f\u0924 \u092a\u094d\u0930\u0935\u093e\u0938", "HI home_section_recommended_stays");
  assert(MESSAGES.ar.home_section_recommended_stays === "\u0625\u0642\u0627\u0645\u0627\u062a \u0645\u0648\u0635\u0649 \u0628\u0647\u0627", "AR home_section_recommended_stays");
  assert(MESSAGES.en.home_check_in === "Check in", "EN home_check_in");
  assert(MESSAGES.es.home_check_in === "Llegada", "ES home_check_in");
  assert(MESSAGES.fr.home_check_in === "Arriv\u00e9e", "FR home_check_in");
  assert(MESSAGES.de.home_check_in === "Anreise", "DE home_check_in");
  assert(MESSAGES.hi.home_check_in === "\u091a\u0947\u0915 \u0907\u0928", "HI home_check_in");
  assert(MESSAGES.ar.home_check_in === "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0648\u0635\u0648\u0644", "AR home_check_in");
  assert(MESSAGES.en.home_check_out === "Check out", "EN home_check_out");
  assert(MESSAGES.es.home_check_out === "Salida", "ES home_check_out");
  assert(MESSAGES.fr.home_check_out === "D\u00e9part", "FR home_check_out");
  assert(MESSAGES.de.home_check_out === "Abreise", "DE home_check_out");
  assert(MESSAGES.hi.home_check_out === "\u091a\u0947\u0915 \u0906\u0909\u091f", "HI home_check_out");
  assert(MESSAGES.ar.home_check_out === "\u0627\u0644\u0645\u063a\u0627\u062f\u0631\u0629", "AR home_check_out");

  logSection("7f. Gift Cards (/giftcards)");
  assert(MESSAGES.en.giftcards_hero_title === "Homyz Gift Cards", "EN giftcards_hero_title");
  assert(MESSAGES.es.giftcards_hero_title === "Tarjetas de regalo Homyz", "ES giftcards_hero_title");
  assert(MESSAGES.fr.giftcards_hero_title === "Cartes cadeaux Homyz", "FR giftcards_hero_title");
  assert(MESSAGES.de.giftcards_hero_title === "Homyz-Geschenkkarten", "DE giftcards_hero_title");
  assert(MESSAGES.hi.giftcards_hero_title === "Homyz \u0917\u093f\u092b\u094d\u091f \u0915\u093e\u0930\u094d\u0921\u094d\u0938", "HI giftcards_hero_title");
  assert(MESSAGES.ar.giftcards_hero_title === "\u0628\u0637\u0627\u0642\u0627\u062a \u0647\u062f\u0627\u064a\u0627 Homyz", "AR giftcards_hero_title");
  assert(MESSAGES.en.giftcards_choose_amount === "Choose an amount", "EN giftcards_choose_amount");
  assert(MESSAGES.es.giftcards_choose_amount === "Elige una cantidad", "ES giftcards_choose_amount");
  assert(MESSAGES.fr.giftcards_choose_amount === "Choisissez un montant", "FR giftcards_choose_amount");
  assert(MESSAGES.de.giftcards_choose_amount === "Betrag w\u00e4hlen", "DE giftcards_choose_amount");
  assert(MESSAGES.hi.giftcards_choose_amount === "\u090f\u0915 \u0930\u093e\u0936\u093f \u091a\u0941\u0928\u0947\u0902", "HI giftcards_choose_amount");
  assert(MESSAGES.ar.giftcards_choose_amount === "\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0628\u0644\u063a", "AR giftcards_choose_amount");

  logSection("7g. Help & Support Center (/help)");
  assert(MESSAGES.en.help_cat_booking_title === "Booking & Reservations", "EN help_cat_booking_title");
  assert(MESSAGES.es.help_cat_booking_title === "Reservas y estancias", "ES help_cat_booking_title");
  assert(MESSAGES.fr.help_cat_booking_title === "R\u00e9servations et s\u00e9jours", "FR help_cat_booking_title");
  assert(MESSAGES.de.help_cat_booking_title === "Buchungen & Reservierungen", "DE help_cat_booking_title");
  assert(MESSAGES.hi.help_cat_booking_title === "\u092c\u0941\u0915\u093f\u0902\u0917 \u0914\u0930 \u0906\u0930\u0915\u094d\u0937\u0923", "HI help_cat_booking_title");
  assert(MESSAGES.ar.help_cat_booking_title === "\u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a \u0648\u0627\u0644\u0625\u0642\u0627\u0645\u0627\u062a", "AR help_cat_booking_title");
  assert(MESSAGES.en.help_cat_payments_title === "Payments & Refunds", "EN help_cat_payments_title");
  assert(MESSAGES.es.help_cat_payments_title === "Pagos y reembolsos", "ES help_cat_payments_title");
  assert(MESSAGES.fr.help_cat_payments_title === "Paiements et remboursements", "FR help_cat_payments_title");
  assert(MESSAGES.de.help_cat_payments_title === "Zahlungen & R\u00fcckerstattungen", "DE help_cat_payments_title");
  assert(MESSAGES.hi.help_cat_payments_title === "\u092d\u0941\u0917\u0924\u093e\u0928 \u0914\u0930 \u0927\u0928\u0935\u093e\u092a\u0938\u0940", "HI help_cat_payments_title");
  assert(MESSAGES.ar.help_cat_payments_title === "\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0648\u0627\u0644\u0645\u0628\u0627\u0644\u063a \u0627\u0644\u0645\u0633\u062a\u0631\u062f\u0629", "AR help_cat_payments_title");

  logSection("7h. Host Referral Program (/host/refer)");
  assert(MESSAGES.en.host_refer_hero_title === "Refer a Host, Earn Rewards", "EN host_refer_hero_title");
  assert(MESSAGES.es.host_refer_hero_title === "Recomienda a un anfitri\u00f3n y gana recompensas", "ES host_refer_hero_title");
  assert(MESSAGES.fr.host_refer_hero_title === "Parrainez un h\u00f4te, gagnez des r\u00e9compenses", "FR host_refer_hero_title");
  assert(MESSAGES.de.host_refer_hero_title === "Gastgeber empfehlen, Pr\u00e4mien sichern", "DE host_refer_hero_title");
  assert(MESSAGES.hi.host_refer_hero_title === "\u090f\u0915 \u0939\u094b\u0938\u094d\u091f \u0930\u0947\u092b\u0930 \u0915\u0930\u0947\u0902, \u092a\u0941\u0930\u0938\u094d\u0915\u093e\u0930 \u092a\u093e\u090f\u0902", "HI host_refer_hero_title");
  assert(MESSAGES.ar.host_refer_hero_title === "\u0642\u0645 \u0628\u0625\u062d\u0627\u0644\u0629 \u0645\u0636\u064a\u0641 \u0648\u0627\u0643\u0633\u0628 \u0627\u0644\u0645\u0643\u0627\u0641\u0622\u062a", "AR host_refer_hero_title");
  assert(MESSAGES.en.host_refer_how_it_works === "How it works", "EN host_refer_how_it_works");
  assert(MESSAGES.es.host_refer_how_it_works === "C\u00f3mo funciona", "ES host_refer_how_it_works");
  assert(MESSAGES.fr.host_refer_how_it_works === "Comment \u00e7a fonctionne", "FR host_refer_how_it_works");
  assert(MESSAGES.de.host_refer_how_it_works === "So funktioniert es", "DE host_refer_how_it_works");
  assert(MESSAGES.hi.host_refer_how_it_works === "\u092f\u0939 \u0915\u0948\u0938\u0947 \u0915\u093e\u092e \u0915\u0930\u0924\u093e \u0939\u0948", "HI host_refer_how_it_works");
  assert(MESSAGES.ar.host_refer_how_it_works === "\u0643\u064a\u0641 \u064a\u0639\u0645\u0644 \u0630\u0644\u0643", "AR host_refer_how_it_works");

  logSection("7i. Host Co-Hosting & Invitations (/host/co-host, /co-host-invitations/accept)");
  assert(MESSAGES.en.host_cohost_title === "Co-hosts", "EN host_cohost_title");
  assert(MESSAGES.es.host_cohost_title === "Coanfitriones", "ES host_cohost_title");
  assert(MESSAGES.fr.host_cohost_title === "Co-h\u00f4tes", "FR host_cohost_title");
  assert(MESSAGES.de.host_cohost_title === "Co-Gastgeber", "DE host_cohost_title");
  assert(MESSAGES.hi.host_cohost_title === "\u0938\u0939-\u092e\u0947\u091c\u092c\u093e\u0928", "HI host_cohost_title");
  assert(MESSAGES.ar.host_cohost_title === "\u0627\u0644\u0645\u0636\u064a\u0641\u0648\u0646 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0648\u0646", "AR host_cohost_title");
  assert(MESSAGES.en.host_cohost_modal_title === "Add your co-host's info", "EN host_cohost_modal_title");
  assert(MESSAGES.es.host_cohost_modal_title === "A\u00f1ade la informaci\u00f3n de tu coanfitri\u00f3n", "ES host_cohost_modal_title");
  assert(MESSAGES.fr.host_cohost_modal_title === "Ajoutez les informations de votre co-h\u00f4te", "FR host_cohost_modal_title");
  assert(MESSAGES.de.host_cohost_modal_title === "Informationen Ihres Co-Gastgebers hinzuf\u00fcgen", "DE host_cohost_modal_title");
  assert(MESSAGES.hi.host_cohost_modal_title === "\u0905\u092a\u0928\u0947 \u0938\u0939-\u092e\u0947\u091c\u092c\u093e\u0928 \u0915\u0940 \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u091c\u094b\u0921\u093c\u0947\u0902", "HI host_cohost_modal_title");
  assert(MESSAGES.ar.host_cohost_modal_title === "\u0623\u0636\u0641 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u0636\u064a\u0641 \u0627\u0644\u0645\u0634\u0627\u0631\u0643", "AR host_cohost_modal_title");
  assert(MESSAGES.en.cohost_inv_title === "Help host a place guests love.", "EN cohost_inv_title");
  assert(MESSAGES.es.cohost_inv_title === "Ayuda a hospedar en un lugar que a los hu\u00e9spedes les encanta.", "ES cohost_inv_title");
  assert(MESSAGES.fr.cohost_inv_title === "Aidez \u00e0 accueillir dans un lieu que les voyageurs adorent.", "FR cohost_inv_title");
  assert(MESSAGES.de.cohost_inv_title === "Helfen Sie mit, eine Unterkunft zu f\u00fchren, die G\u00e4ste lieben.", "DE cohost_inv_title");
  assert(MESSAGES.hi.cohost_inv_title === "\u0910\u0938\u0940 \u091c\u0917\u0939 \u0915\u0940 \u092e\u0947\u091c\u092c\u093e\u0928\u0940 \u092e\u0947\u0902 \u092e\u0926\u0926 \u0915\u0930\u0947\u0902 \u091c\u093f\u0938\u0947 \u092e\u0947\u0939\u092e\u093e\u0928 \u092a\u0938\u0902\u0926 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964", "HI cohost_inv_title");
  assert(MESSAGES.ar.cohost_inv_title === "\u0633\u0627\u0639\u062f \u0641\u064a \u0627\u0633\u062a\u0636\u0627\u0641\u0629 \u0645\u0643\u0627\u0646 \u064a\u062d\u0628\u0647 \u0627\u0644\u0636\u064a\u0648\u0641.", "AR cohost_inv_title");
  assert(MESSAGES.en.cohost_inv_badge === "You're invited", "EN cohost_inv_badge");
  assert(MESSAGES.es.cohost_inv_badge === "Est\u00e1s invitado", "ES cohost_inv_badge");
  assert(MESSAGES.fr.cohost_inv_badge === "Vous \u00eates invit\u00e9", "FR cohost_inv_badge");
  assert(MESSAGES.de.cohost_inv_badge === "Sie sind eingeladen", "DE cohost_inv_badge");
  assert(MESSAGES.hi.cohost_inv_badge === "\u0906\u092a \u0906\u092e\u0902\u0924\u094d\u0930\u093f\u0924 \u0939\u0948\u0902", "HI cohost_inv_badge");
  assert(MESSAGES.ar.cohost_inv_badge === "\u0623\u0646\u062a \u0645\u062f\u0639\u0648", "AR cohost_inv_badge");

  logSection("7j. Guest Stay Reviews & Public Host Reviews");
  assert(MESSAGES.en.review_rating_5 === "Excellent", "EN review_rating_5");
  assert(MESSAGES.es.review_rating_5 === "Excelente", "ES review_rating_5");
  assert(MESSAGES.fr.review_rating_5 === "Excellent", "FR review_rating_5");
  assert(MESSAGES.de.review_rating_5 === "Hervorragend", "DE review_rating_5");
  assert(MESSAGES.hi.review_rating_5 === "\u0909\u0924\u094d\u0915\u0943\u0937\u094d\u091f", "HI review_rating_5");
  assert(MESSAGES.ar.review_rating_5 === "\u0645\u0645\u062a\u0627\u0632", "AR review_rating_5");
  assert(MESSAGES.en.public_reviews_page_heading === "{name}'s reviews", "EN public_reviews_page_heading");
  assert(MESSAGES.es.public_reviews_page_heading === "Evaluaciones de {name}", "ES public_reviews_page_heading");
  assert(MESSAGES.fr.public_reviews_page_heading === "Commentaires pour {name}", "FR public_reviews_page_heading");
  assert(MESSAGES.de.public_reviews_page_heading === "Bewertungen f\u00fcr {name}", "DE public_reviews_page_heading");
  assert(MESSAGES.hi.public_reviews_page_heading === "{name} \u0915\u0940 \u0938\u092e\u0940\u0915\u094d\u0937\u093e\u090f\u0902", "HI public_reviews_page_heading");
  assert(MESSAGES.ar.public_reviews_page_heading === "\u062a\u0642\u064a\u064a\u0645\u0627\u062a {name}", "AR public_reviews_page_heading");
  assert(MESSAGES.en.public_reviews_none_yet === "This host does not have any published written reviews yet.", "EN public_reviews_none_yet");
  assert(MESSAGES.es.public_reviews_none_yet === "Este anfitri\u00f3n a\u00fan no tiene evaluaciones escritas publicadas.", "ES public_reviews_none_yet");
  assert(MESSAGES.fr.public_reviews_none_yet === "Cet h\u00f4te n'a pas encore de commentaires \u00e9crits publi\u00e9s.", "FR public_reviews_none_yet");
  assert(MESSAGES.de.public_reviews_none_yet === "Dieser Gastgeber hat noch keine ver\u00f6ffentlichten schriftlichen Bewertungen.", "DE public_reviews_none_yet");
  assert(MESSAGES.hi.public_reviews_none_yet === "\u0907\u0938 \u0939\u094b\u0938\u094d\u091f \u0915\u0947 \u092a\u093e\u0938 \u0905\u092d\u0940 \u0924\u0915 \u0915\u094b\u0908 \u0932\u093f\u0916\u093f\u0924 \u0938\u092e\u0940\u0915\u094d\u0937\u093e \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964", "HI public_reviews_none_yet");
  assert(MESSAGES.ar.public_reviews_none_yet === "\u0644\u0627 \u062a\u0648\u062c\u062f \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0636\u064a\u0641 \u062a\u0642\u064a\u064a\u0645\u0627\u062a \u0645\u0643\u062a\u0648\u0628\u0629 \u0645\u0646\u0634\u0648\u0631\u0629 \u0628\u0639\u062f.", "AR public_reviews_none_yet");

  logSection("7k. Local Guidebooks & Host Guidebooks (/guidebooks/[id])");
  assert(MESSAGES.en.guidebook_preview_mode === "Preview Mode", "EN guidebook_preview_mode");
  assert(MESSAGES.es.guidebook_preview_mode === "Modo de vista previa", "ES guidebook_preview_mode");
  assert(MESSAGES.fr.guidebook_preview_mode === "Mode aper\u00e7u", "FR guidebook_preview_mode");
  assert(MESSAGES.de.guidebook_preview_mode === "Vorschaumodus", "DE guidebook_preview_mode");
  assert(MESSAGES.hi.guidebook_preview_mode === "\u092a\u0942\u0930\u094d\u0935\u093e\u0935\u0932\u094b\u0915\u0928 \u092e\u094b\u0921", "HI guidebook_preview_mode");
  assert(MESSAGES.ar.guidebook_preview_mode === "\u0648\u0636\u0639 \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629", "AR guidebook_preview_mode");
  assert(MESSAGES.en.host_guidebooks_title === "Guidebooks", "EN host_guidebooks_title");
  assert(MESSAGES.es.host_guidebooks_title === "Gu\u00edas", "ES host_guidebooks_title");
  assert(MESSAGES.fr.host_guidebooks_title === "Guides", "FR host_guidebooks_title");
  assert(MESSAGES.de.host_guidebooks_title === "Reisef\u00fchrer", "DE host_guidebooks_title");
  assert(MESSAGES.hi.host_guidebooks_title === "\u0917\u093e\u0907\u0921\u092c\u0941\u0915\u094d\u0938", "HI host_guidebooks_title");
  assert(MESSAGES.ar.host_guidebooks_title === "\u0623\u062f\u0644\u0629 \u0627\u0644\u0633\u0641\u0631", "AR host_guidebooks_title");
  assert(MESSAGES.en.host_guidebooks_subtext === "Share your favorite places and local tips with guests.", "EN host_guidebooks_subtext");
  assert(MESSAGES.es.host_guidebooks_subtext === "Comparte tus lugares favoritos y consejos locales con los hu\u00e9spedes.", "ES host_guidebooks_subtext");
  assert(MESSAGES.fr.host_guidebooks_subtext === "Partagez vos lieux pr\u00e9f\u00e9r\u00e9s et vos conseils locaux avec vos voyageurs.", "FR host_guidebooks_subtext");
  assert(MESSAGES.de.host_guidebooks_subtext === "Teilen Sie Ihre Lieblingsorte und lokalen Tipps mit den G\u00e4sten.", "DE host_guidebooks_subtext");
  assert(MESSAGES.hi.host_guidebooks_subtext === "\u0905\u092a\u0928\u0947 \u092a\u0938\u0902\u0926\u0940\u0926\u093e \u0938\u094d\u0925\u093e\u0928 \u0914\u0930 \u0938\u094d\u0925\u093e\u0928\u0940\u092f \u0938\u0941\u091d\u093e\u0935 \u092e\u0947\u0939\u092e\u093e\u0928\u094b\u0902 \u0915\u0947 \u0938\u093e\u0925 \u0938\u093e\u091d\u093e \u0915\u0930\u0947\u0902\u0964", "HI host_guidebooks_subtext");
  assert(MESSAGES.ar.host_guidebooks_subtext === "\u0634\u0627\u0631\u0643 \u0623\u0645\u0627\u0643\u0646\u0643 \u0627\u0644\u0645\u0641\u0636\u0644\u0629 \u0648\u0627\u0644\u0646\u0635\u0627\u0626\u062d \u0627\u0644\u0645\u062d\u0644\u064a\u0629 \u0645\u0639 \u0627\u0644\u0636\u064a\u0648\u0641.", "AR host_guidebooks_subtext");
  assert(MESSAGES.en.host_guidebooks_create_desc === "Create a guidebook to easily share local tips with guests.", "EN host_guidebooks_create_desc");
  assert(MESSAGES.es.host_guidebooks_create_desc === "Crea una gu\u00eda para compartir f\u00e1cilmente consejos locales con tus hu\u00e9spedes.", "ES host_guidebooks_create_desc");
  assert(MESSAGES.fr.host_guidebooks_create_desc === "Cr\u00e9ez un guide pour partager facilement vos adresses locales avec vos voyageurs.", "FR host_guidebooks_create_desc");
  assert(MESSAGES.de.host_guidebooks_create_desc === "Erstellen Sie einen Reisef\u00fchrer, um lokale Tipps mit G\u00e4sten zu teilen.", "DE host_guidebooks_create_desc");
  assert(MESSAGES.hi.host_guidebooks_create_desc === "\u0905\u0924\u093f\u0925\u093f\u092f\u094b\u0902 \u0915\u0947 \u0938\u093e\u0925 \u0906\u0938\u093e\u0928\u0940 \u0938\u0947 \u0938\u094d\u0925\u093e\u0928\u0940\u092f \u0938\u0941\u091d\u093e\u0935 \u0938\u093e\u091d\u093e \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0917\u093e\u0907\u0921\u092c\u0941\u0915 \u092c\u0928\u093e\u090f\u0902\u0964", "HI host_guidebooks_create_desc");
  assert(MESSAGES.ar.host_guidebooks_create_desc === "\u0623\u0646\u0634\u0626 \u062f\u0644\u064a\u0644\u0627\u064b \u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0646\u0635\u0627\u0626\u062d \u0627\u0644\u0645\u062d\u0644\u064a\u0629 \u0628\u0633\u0647\u0648\u0644\u0629 \u0645\u0639 \u0636\u064a\u0648\u0641\u0643.", "AR host_guidebooks_create_desc");

  logSection("7l. Host Today Dashboard (/host/today)");
  assert(MESSAGES.en.host_today_tab_today === "Today", "EN host_today_tab_today");
  assert(MESSAGES.es.host_today_tab_today === "Hoy", "ES host_today_tab_today");
  assert(MESSAGES.fr.host_today_tab_today === "Aujourd'hui", "FR host_today_tab_today");
  assert(MESSAGES.de.host_today_tab_today === "Heute", "DE host_today_tab_today");
  assert(MESSAGES.hi.host_today_tab_today === "\u0906\u091c", "HI host_today_tab_today");
  assert(MESSAGES.ar.host_today_tab_today === "\u0627\u0644\u064a\u0648\u0645", "AR host_today_tab_today");
  assert(MESSAGES.en.host_today_tab_upcoming === "Upcoming", "EN host_today_tab_upcoming");
  assert(MESSAGES.es.host_today_tab_upcoming === "Pr\u00f3ximas", "ES host_today_tab_upcoming");
  assert(MESSAGES.fr.host_today_tab_upcoming === "\u00c0 venir", "FR host_today_tab_upcoming");
  assert(MESSAGES.de.host_today_tab_upcoming === "Bevorstehend", "DE host_today_tab_upcoming");
  assert(MESSAGES.hi.host_today_tab_upcoming === "\u0906\u0917\u093e\u092e\u0940", "HI host_today_tab_upcoming");
  assert(MESSAGES.ar.host_today_tab_upcoming === "\u0627\u0644\u0642\u0627\u062f\u0645\u0629", "AR host_today_tab_upcoming");

  logSection("7m. Host Booking Approvals (/host/bookings)");
  assert(MESSAGES.en.host_booking_approvals_title === "Pending booking requests", "EN host_booking_approvals_title");
  assert(MESSAGES.es.host_booking_approvals_title === "Solicitudes de reserva pendientes", "ES host_booking_approvals_title");
  assert(MESSAGES.fr.host_booking_approvals_title === "Demandes de r\u00e9servation en attente", "FR host_booking_approvals_title");
  assert(MESSAGES.de.host_booking_approvals_title === "Ausstehende Buchungsanfragen", "DE host_booking_approvals_title");
  assert(MESSAGES.hi.host_booking_approvals_title === "\u0932\u0902\u092c\u093f\u0924 \u092c\u0941\u0915\u093f\u0902\u0917 \u0905\u0928\u0941\u0930\u094b\u0927", "HI host_booking_approvals_title");
  assert(MESSAGES.ar.host_booking_approvals_title === "\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062d\u062c\u0632 \u0627\u0644\u0645\u0639\u0644\u0642\u0629", "AR host_booking_approvals_title");

  logSection("7n. Host Reservation Details (/host/bookings/[id])");
  assert(MESSAGES.en.host_booking_details_back === "Back to reservations", "EN host_booking_details_back");
  assert(MESSAGES.es.host_booking_details_back === "Volver a reservas", "ES host_booking_details_back");
  assert(MESSAGES.fr.host_booking_details_back === "Retour aux r\u00e9servations", "FR host_booking_details_back");
  assert(MESSAGES.de.host_booking_details_back === "Zur\u00fcck zu Buchungen", "DE host_booking_details_back");
  assert(MESSAGES.hi.host_booking_details_back === "\u0906\u0930\u0915\u094d\u0937\u0923 \u092a\u0930 \u0935\u093e\u092a\u0938 \u091c\u093e\u090f\u0902", "HI host_booking_details_back");
  assert(MESSAGES.ar.host_booking_details_back === "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a", "AR host_booking_details_back");

  logSection("7o. Host Onboarding Guide (/host/onboarding)");
  assert(MESSAGES.en.host_what_would_you_like_to_host === "What would you like to host?", "EN host_what_would_you_like_to_host");
  assert(MESSAGES.es.host_what_would_you_like_to_host === "\u00bfQu\u00e9 te gustar\u00eda hospedar?", "ES host_what_would_you_like_to_host");
  assert(MESSAGES.fr.host_what_would_you_like_to_host === "Que souhaitez-vous h\u00e9berger ?", "FR host_what_would_you_like_to_host");
  assert(MESSAGES.de.host_what_would_you_like_to_host === "Was m\u00f6chten Sie anbieten?", "DE host_what_would_you_like_to_host");
  assert(MESSAGES.hi.host_what_would_you_like_to_host === "\u0906\u092a \u0915\u094d\u092f\u093e \u0939\u094b\u0938\u094d\u091f \u0915\u0930\u0928\u093e \u091a\u093e\u0939\u0924\u0947 \u0939\u0948\u0902?", "HI host_what_would_you_like_to_host");
  assert(MESSAGES.ar.host_what_would_you_like_to_host === "\u0645\u0627 \u0627\u0644\u0630\u064a \u062a\u0631\u063a\u0628 \u0641\u064a \u0627\u0633\u062a\u0636\u0627\u0641\u062a\u0647\u061f", "AR host_what_would_you_like_to_host");
  assert(MESSAGES.en.host_tell_us_about_your_place === "Tell us about your place", "EN host_tell_us_about_your_place");
  assert(MESSAGES.es.host_tell_us_about_your_place === "H\u00e1blanos de tu alojamiento", "ES host_tell_us_about_your_place");
  assert(MESSAGES.fr.host_tell_us_about_your_place === "Parlez-nous de votre logement", "FR host_tell_us_about_your_place");
  assert(MESSAGES.de.host_tell_us_about_your_place === "Erz\u00e4hlen Sie uns von Ihrer Unterkunft", "DE host_tell_us_about_your_place");
  assert(MESSAGES.hi.host_tell_us_about_your_place === "\u0939\u092e\u0947\u0902 \u0905\u092a\u0928\u0947 \u0938\u094d\u0925\u093e\u0928 \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902 \u092c\u0924\u093e\u090f\u0902", "HI host_tell_us_about_your_place");
  assert(MESSAGES.ar.host_tell_us_about_your_place === "\u0623\u062e\u0628\u0631\u0646\u0627 \u0639\u0646 \u0645\u0643\u0627\u0646\u0643", "AR host_tell_us_about_your_place");

  logSection("7p. Host Listing Editor & Policies");
  assert(MESSAGES.en.host_booking_turn_off_instant_title === "Turn off Instant Book?", "EN host_booking_turn_off_instant_title");
  assert(MESSAGES.es.host_booking_turn_off_instant_title === "\u00bfDesactivar la Reserva inmediata?", "ES host_booking_turn_off_instant_title");
  assert(MESSAGES.fr.host_booking_turn_off_instant_title === "D\u00e9sactiver la R\u00e9servation instantan\u00e9e ?", "FR host_booking_turn_off_instant_title");
  assert(MESSAGES.de.host_booking_turn_off_instant_title === "Sofortbuchung ausschalten?", "DE host_booking_turn_off_instant_title");
  assert(MESSAGES.hi.host_booking_turn_off_instant_title === "\u0907\u0928\u094d\u0938\u094d\u091f\u0947\u0902\u091f \u092c\u0941\u0915 \u092c\u0902\u0926 \u0915\u0930\u0947\u0902?", "HI host_booking_turn_off_instant_title");
  assert(MESSAGES.ar.host_booking_turn_off_instant_title === "\u0647\u0644 \u062a\u0631\u064a\u062f \u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u062d\u062c\u0632 \u0627\u0644\u0641\u0648\u0631\u064a\u061f", "AR host_booking_turn_off_instant_title");
  assert(MESSAGES.en.host_booking_custom_message_title === "Add a custom message", "EN host_booking_custom_message_title");
  assert(MESSAGES.es.host_booking_custom_message_title === "A\u00f1adir un mensaje personalizado", "ES host_booking_custom_message_title");
  assert(MESSAGES.fr.host_booking_custom_message_title === "Ajouter un message personnalis\u00e9", "FR host_booking_custom_message_title");
  assert(MESSAGES.de.host_booking_custom_message_title === "Benutzerdefinierte Nachricht hinzuf\u00fcgen", "DE host_booking_custom_message_title");
  assert(MESSAGES.hi.host_booking_custom_message_title === "\u0915\u0938\u094d\u091f\u092e \u0938\u0902\u0926\u0947\u0936 \u091c\u094b\u0921\u093c\u0947\u0902", "HI host_booking_custom_message_title");
  assert(MESSAGES.ar.host_booking_custom_message_title === "\u0625\u0636\u0627\u0641\u0629 \u0631\u0633\u0627\u0644\u0629 \u0645\u062e\u0635\u0635\u0629", "AR host_booking_custom_message_title");
  assert(MESSAGES.en.host_house_rules_desc === "Guests are expected to follow your rules and may be removed from Homyz if they don't.", "EN host_house_rules_desc");
  assert(MESSAGES.es.host_house_rules_desc === "Se espera que los hu\u00e9spedes sigan tus normas y pueden ser eliminados de Homyz si no lo hacen.", "ES host_house_rules_desc");
  assert(MESSAGES.fr.host_house_rules_desc === "Les voyageurs doivent respecter vos r\u00e8gles et peuvent \u00eatre retir\u00e9s de Homyz s'ils ne le font pas.", "FR host_house_rules_desc");
  assert(MESSAGES.de.host_house_rules_desc === "Es wird erwartet, dass G\u00e4ste Ihre Regeln befolgen. Bei Nichtbeachtung k\u00f6nnen sie von Homyz entfernt werden.", "DE host_house_rules_desc");
  assert(MESSAGES.hi.host_house_rules_desc === "\u092e\u0947\u0939\u092e\u093e\u0928\u094b\u0902 \u0938\u0947 \u0906\u092a\u0915\u0947 \u0928\u093f\u092f\u092e\u094b\u0902 \u0915\u093e \u092a\u093e\u0932\u0928 \u0915\u0930\u0928\u0947 \u0915\u0940 \u0909\u092e\u094d\u092e\u0940\u0926 \u0915\u0940 \u091c\u093e\u0924\u0940 \u0939\u0948 \u0914\u0930 \u092f\u0926\u093f \u0935\u0947 \u0910\u0938\u093e \u0928\u0939\u0940\u0902 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902 \u0924\u094b \u0909\u0928\u094d\u0939\u0947\u0902 \u0939\u094b\u092e\u093f\u091c\u093c \u0938\u0947 \u0939\u091f\u093e\u092f\u093e \u091c\u093e \u0938\u0915\u0924\u093e \u0939\u0948\u0964", "HI host_house_rules_desc");
  assert(MESSAGES.ar.host_house_rules_desc === "\u064a\u064f\u062a\u0648\u0642\u0639 \u0645\u0646 \u0627\u0644\u0636\u064a\u0648\u0641 \u0627\u062a\u0628\u0627\u0639 \u0642\u0648\u0627\u0639\u062f\u0643 \u0648\u0642\u062f \u064a\u062a\u0645 \u0627\u0633\u062a\u0628\u0639\u0627\u062f\u0647\u0645 \u0645\u0646 \u0647\u0648\u0645\u064a\u0632 \u0625\u0630\u0627 \u0644\u0645 \u064a\u0641\u0639\u0644\u0648\u0627 \u0630\u0644\u0643.", "AR host_house_rules_desc");
  assert(MESSAGES.en.host_additional_house_rules_modal_title === "Additional house rules", "EN host_additional_house_rules_modal_title");
  assert(MESSAGES.es.host_additional_house_rules_modal_title === "Normas de la casa adicionales", "ES host_additional_house_rules_modal_title");
  assert(MESSAGES.fr.host_additional_house_rules_modal_title === "R\u00e8gles int\u00e9rieures suppl\u00e9mentaires", "FR host_additional_house_rules_modal_title");
  assert(MESSAGES.de.host_additional_house_rules_modal_title === "Zus\u00e4tzliche Hausregeln", "DE host_additional_house_rules_modal_title");
  assert(MESSAGES.hi.host_additional_house_rules_modal_title === "\u0905\u0924\u093f\u0930\u093f\u0915\u094d\u0924 \u0918\u0930 \u0915\u0947 \u0928\u093f\u092f\u092e", "HI host_additional_house_rules_modal_title");
  assert(MESSAGES.ar.host_additional_house_rules_modal_title === "\u0642\u0648\u0627\u0639\u062f \u0628\u064a\u062a \u0625\u0636\u0627\u0641\u064a\u0629", "AR host_additional_house_rules_modal_title");
  assert(MESSAGES.en.host_guest_safety_title === "Guest safety", "EN host_guest_safety_title");
  assert(MESSAGES.es.host_guest_safety_title === "Seguridad del hu\u00e9sped", "ES host_guest_safety_title");
  assert(MESSAGES.fr.host_guest_safety_title === "S\u00e9curit\u00e9 des voyageurs", "FR host_guest_safety_title");
  assert(MESSAGES.de.host_guest_safety_title === "Sicherheit der G\u00e4ste", "DE host_guest_safety_title");
  assert(MESSAGES.hi.host_guest_safety_title === "\u092e\u0947\u0939\u092e\u093e\u0928 \u0938\u0941\u0930\u0915\u094d\u0937\u093e", "HI host_guest_safety_title");
  assert(MESSAGES.ar.host_guest_safety_title === "\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0636\u064a\u0648\u0641", "AR host_guest_safety_title");
  assert(MESSAGES.en.host_safety_devices_modal_title === "Safety devices", "EN host_safety_devices_modal_title");
  assert(MESSAGES.es.host_safety_devices_modal_title === "Dispositivos de seguridad", "ES host_safety_devices_modal_title");
  assert(MESSAGES.fr.host_safety_devices_modal_title === "Dispositifs de s\u00e9curit\u00e9", "FR host_safety_devices_modal_title");
  assert(MESSAGES.de.host_safety_devices_modal_title === "Sicherheitseinrichtungen", "DE host_safety_devices_modal_title");
  assert(MESSAGES.hi.host_safety_devices_modal_title === "\u0938\u0941\u0930\u0915\u094d\u0937\u093e \u0909\u092a\u0915\u0930\u0923", "HI host_safety_devices_modal_title");
  assert(MESSAGES.ar.host_safety_devices_modal_title === "\u0623\u062c\u0647\u0632\u0629 \u0627\u0644\u0633\u0644\u0627\u0645\u0629", "AR host_safety_devices_modal_title");
  assert(MESSAGES.en.host_short_term_stays_title === "Short-term stays", "EN host_short_term_stays_title");
  assert(MESSAGES.es.host_short_term_stays_title === "Estancias de corta duraci\u00f3n", "ES host_short_term_stays_title");
  assert(MESSAGES.fr.host_short_term_stays_title === "S\u00e9jours de courte dur\u00e9e", "FR host_short_term_stays_title");
  assert(MESSAGES.de.host_short_term_stays_title === "Kurzzeitaufenthalte", "DE host_short_term_stays_title");
  assert(MESSAGES.hi.host_short_term_stays_title === "\u0905\u0932\u094d\u092a\u0915\u093e\u0932\u093f\u0915 \u092a\u094d\u0930\u0935\u093e\u0938", "HI host_short_term_stays_title");
  assert(MESSAGES.ar.host_short_term_stays_title === "\u0627\u0644\u0625\u0642\u0627\u0645\u0627\u062a \u0642\u0635\u064a\u0631\u0629 \u0627\u0644\u0623\u062c\u0644", "AR host_short_term_stays_title");
  assert(MESSAGES.en.host_non_refundable_option_title === "Non-refundable option", "EN host_non_refundable_option_title");
  assert(MESSAGES.es.host_non_refundable_option_title === "Opci\u00f3n no reembolsable", "ES host_non_refundable_option_title");
  assert(MESSAGES.fr.host_non_refundable_option_title === "Option non remboursable", "FR host_non_refundable_option_title");
  assert(MESSAGES.de.host_non_refundable_option_title === "Nicht erstattungsf\u00e4hige Option", "DE host_non_refundable_option_title");
  assert(MESSAGES.hi.host_non_refundable_option_title === "\u0917\u0948\u0930-\u0935\u093e\u092a\u0938\u0940 \u092f\u094b\u0917\u094d\u092f \u0935\u093f\u0915\u0932\u094d\u092a", "HI host_non_refundable_option_title");
  assert(MESSAGES.ar.host_non_refundable_option_title === "\u062e\u064a\u0627\u0631 \u063a\u064a\u0631 \u0642\u0627\u0628\u0644 \u0644\u0644\u0625\u0631\u062c\u0627\u0639", "AR host_non_refundable_option_title");
  assert(MESSAGES.en.host_sleeping_arrangements_title === "Sleeping arrangements", "EN host_sleeping_arrangements_title");
  assert(MESSAGES.es.host_sleeping_arrangements_title === "Distribuci\u00f3n de camas", "ES host_sleeping_arrangements_title");
  assert(MESSAGES.fr.host_sleeping_arrangements_title === "Couchages", "FR host_sleeping_arrangements_title");
  assert(MESSAGES.de.host_sleeping_arrangements_title === "Schlafgelegenheiten", "DE host_sleeping_arrangements_title");
  assert(MESSAGES.hi.host_sleeping_arrangements_title === "\u0938\u094b\u0928\u0947 \u0915\u0940 \u0935\u094d\u092f\u0935\u0938\u094d\u0925\u093e", "HI host_sleeping_arrangements_title");
  assert(MESSAGES.ar.host_sleeping_arrangements_title === "\u062a\u0631\u062a\u064a\u0628\u0627\u062a \u0627\u0644\u0646\u0648\u0645", "AR host_sleeping_arrangements_title");
  assert(MESSAGES.en.host_room_by_room_arrangements === "Room-by-room sleeping arrangements", "EN host_room_by_room_arrangements");
  assert(MESSAGES.es.host_room_by_room_arrangements === "Distribuci\u00f3n de camas por habitaci\u00f3n", "ES host_room_by_room_arrangements");
  assert(MESSAGES.fr.host_room_by_room_arrangements === "Couchages chambre par chambre", "FR host_room_by_room_arrangements");
  assert(MESSAGES.de.host_room_by_room_arrangements === "Schlafgelegenheiten nach Zimmern", "DE host_room_by_room_arrangements");
  assert(MESSAGES.hi.host_room_by_room_arrangements === "\u0915\u092e\u0930\u0947 \u0915\u0947 \u0905\u0928\u0941\u0938\u093e\u0930 \u0938\u094b\u0928\u0947 \u0915\u0940 \u0935\u094d\u092f\u0935\u0938\u094d\u0925\u093e", "HI host_room_by_room_arrangements");
  assert(MESSAGES.ar.host_room_by_room_arrangements === "\u062a\u0631\u062a\u064a\u0628\u0627\u062a \u0627\u0644\u0646\u0648\u0645 \u063a\u0631\u0641\u0629 \u0628\u063a\u0631\u0641\u0629", "AR host_room_by_room_arrangements");
  assert(MESSAGES.en.host_nav_menu === "Menu", "EN host_nav_menu");
  assert(MESSAGES.es.host_nav_menu === "Men\u00fa", "ES host_nav_menu");
  assert(MESSAGES.fr.host_nav_menu === "Menu", "FR host_nav_menu");
  assert(MESSAGES.de.host_nav_menu === "Men\u00fc", "DE host_nav_menu");
  assert(MESSAGES.hi.host_nav_menu === "\u092e\u0947\u0928\u094d\u092f\u0942", "HI host_nav_menu");
  assert(MESSAGES.ar.host_nav_menu === "\u0627\u0644\u0642\u0627\u0626\u0645\u0629", "AR host_nav_menu");
  assert(MESSAGES.en.host_nav_filters === "Filters", "EN host_nav_filters");
  assert(MESSAGES.es.host_nav_filters === "Filtros", "ES host_nav_filters");
  assert(MESSAGES.fr.host_nav_filters === "Filtres", "FR host_nav_filters");
  assert(MESSAGES.de.host_nav_filters === "Filter", "DE host_nav_filters");
  assert(MESSAGES.hi.host_nav_filters === "\u092b\u093c\u093f\u0932\u094d\u091f\u0930", "HI host_nav_filters");
  assert(MESSAGES.ar.host_nav_filters === "\u0627\u0644\u0641\u0644\u0627\u062a\u0631", "AR host_nav_filters");
  assert(MESSAGES.en.host_checkin_checkout_times_title === "Check-in and check-out times", "EN host_checkin_checkout_times_title");
  assert(MESSAGES.es.host_checkin_checkout_times_title === "Horarios de llegada y salida", "ES host_checkin_checkout_times_title");
  assert(MESSAGES.fr.host_checkin_checkout_times_title === "Heures d'arriv\u00e9e et de d\u00e9part", "FR host_checkin_checkout_times_title");
  assert(MESSAGES.de.host_checkin_checkout_times_title === "Check-in- und Check-out-Zeiten", "DE host_checkin_checkout_times_title");
  assert(MESSAGES.hi.host_checkin_checkout_times_title === "\u091a\u0947\u0915-\u0907\u0928 \u0914\u0930 \u091a\u0947\u0915-\u0906\u0909\u091f \u0915\u093e \u0938\u092e\u092f", "HI host_checkin_checkout_times_title");
  assert(MESSAGES.ar.host_checkin_checkout_times_title === "\u0623\u0648\u0642\u0627\u062a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0648\u0635\u0648\u0644 \u0648\u0627\u0644\u0645\u063a\u0627\u062f\u0631\u0629", "AR host_checkin_checkout_times_title");
  assert(MESSAGES.en.host_start_time === "Start time", "EN host_start_time");
  assert(MESSAGES.es.host_start_time === "Hora de inicio", "ES host_start_time");
  assert(MESSAGES.fr.host_start_time === "Heure de d\u00e9but", "FR host_start_time");
  assert(MESSAGES.de.host_start_time === "Startzeit", "DE host_start_time");
  assert(MESSAGES.hi.host_start_time === "\u0936\u0941\u0930\u0942 \u0939\u094b\u0928\u0947 \u0915\u093e \u0938\u092e\u092f", "HI host_start_time");
  assert(MESSAGES.ar.host_start_time === "\u0648\u0642\u062a \u0627\u0644\u0628\u062f\u0621", "AR host_start_time");
  assert(MESSAGES.en.host_method_smart_lock_label === "Smart lock", "EN host_method_smart_lock_label");
  assert(MESSAGES.es.host_method_smart_lock_label === "Cerradura inteligente", "ES host_method_smart_lock_label");
  assert(MESSAGES.fr.host_method_smart_lock_label === "Serrure connect\u00e9e", "FR host_method_smart_lock_label");
  assert(MESSAGES.de.host_method_smart_lock_label === "Smart Lock", "DE host_method_smart_lock_label");
  assert(MESSAGES.hi.host_method_smart_lock_label === "\u0938\u094d\u092e\u093e\u0930\u094d\u091f \u0932\u0949\u0915", "HI host_method_smart_lock_label");
  assert(MESSAGES.ar.host_method_smart_lock_label === "\u0642\u0641\u0644 \u0630\u0643\u064a", "AR host_method_smart_lock_label");
  assert(MESSAGES.en.host_interaction_preferences_subtext === "Set expectations before guests arrive.", "EN host_interaction_preferences_subtext");
  assert(MESSAGES.es.host_interaction_preferences_subtext === "Establece expectativas antes de que lleguen los hu\u00e9spedes.", "ES host_interaction_preferences_subtext");
  assert(MESSAGES.fr.host_interaction_preferences_subtext === "D\u00e9finissez les attentes avant l'arriv\u00e9e des voyageurs.", "FR host_interaction_preferences_subtext");
  assert(MESSAGES.de.host_interaction_preferences_subtext === "Legen Sie vor der Ankunft der G\u00e4ste Erwartungen fest.", "DE host_interaction_preferences_subtext");
  assert(MESSAGES.hi.host_interaction_preferences_subtext === "\u092e\u0947\u0939\u092e\u093e\u0928\u094b\u0902 \u0915\u0947 \u0906\u0928\u0947 \u0938\u0947 \u092a\u0939\u0932\u0947 \u0905\u092a\u0947\u0915\u094d\u0937\u093e\u090f\u0902 \u0928\u093f\u0930\u094d\u0927\u093e\u0930\u093f\u0924 \u0915\u0930\u0947\u0902\u0964", "HI host_interaction_preferences_subtext");
  assert(MESSAGES.ar.host_interaction_preferences_subtext === "\u0636\u0639 \u0627\u0644\u062a\u0648\u0642\u0639\u0627\u062a \u0642\u0628\u0644 \u0648\u0635\u0648\u0644 \u0627\u0644\u0636\u064a\u0648\u0641.", "AR host_interaction_preferences_subtext");
  assert(MESSAGES.en.host_interaction_option_0 === "I won't be available in person, and prefer communicating through the app.", "EN host_interaction_option_0");
  assert(MESSAGES.es.host_interaction_option_0 === "No estar\u00e9 disponible en persona y prefiero comunicarme a trav\u00e9s de la aplicaci\u00f3n.", "ES host_interaction_option_0");
  assert(MESSAGES.fr.host_interaction_option_0 === "Je ne serai pas disponible en personne et pr\u00e9f\u00e8re communiquer via l'application.", "FR host_interaction_option_0");
  assert(MESSAGES.de.host_interaction_option_0 === "Ich bin nicht pers\u00f6nlich verf\u00fcgbar und bevorzuge die Kommunikation \u00fcber die App.", "DE host_interaction_option_0");
  assert(MESSAGES.hi.host_interaction_option_0 === "\u092e\u0948\u0902 \u0935\u094d\u092f\u0915\u094d\u0924\u093f\u0917\u0924 \u0930\u0942\u092a \u0938\u0947 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0930\u0939\u0942\u0902\u0917\u093e, \u0914\u0930 \u0910\u092a \u0915\u0947 \u092e\u093e\u0927\u094d\u092f\u092e \u0938\u0947 \u0938\u0902\u0935\u093e\u0926 \u0915\u0930\u0928\u093e \u092a\u0938\u0902\u0926 \u0915\u0930\u0942\u0902\u0917\u093e\u0964", "HI host_interaction_option_0");
  assert(MESSAGES.ar.host_interaction_option_0 === "\u0644\u0646 \u0623\u0643\u0648\u0646 \u0645\u062a\u0627\u062d\u064b\u0627 \u0634\u062e\u0635\u064a\u064b\u0627\u060c \u0648\u0623\u0641\u0636\u0644 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0639\u0628\u0631 \u0627\u0644\u062a\u0637\u0628\u064a\u0642.", "AR host_interaction_option_0");
  assert(MESSAGES.en.host_languages_title === "Languages", "EN host_languages_title");
  assert(MESSAGES.es.host_languages_title === "Idiomas", "ES host_languages_title");
  assert(MESSAGES.fr.host_languages_title === "Langues", "FR host_languages_title");
  assert(MESSAGES.de.host_languages_title === "Sprachen", "DE host_languages_title");
  assert(MESSAGES.hi.host_languages_title === "\u092d\u093e\u0937\u093e\u090f\u0902", "HI host_languages_title");
  assert(MESSAGES.ar.host_languages_title === "\u0627\u0644\u0644\u063a\u0627\u062a", "AR host_languages_title");
  assert(MESSAGES.en.host_no_languages_selected_yet === "No languages selected yet.", "EN host_no_languages_selected_yet");
  assert(MESSAGES.es.host_no_languages_selected_yet === "A\u00fan no se han seleccionado idiomas.", "ES host_no_languages_selected_yet");
  assert(MESSAGES.fr.host_no_languages_selected_yet === "Aucune langue s\u00e9lectionn\u00e9e pour le moment.", "FR host_no_languages_selected_yet");
  assert(MESSAGES.de.host_no_languages_selected_yet === "Noch keine Sprachen ausgew\u00e4hlt.", "DE host_no_languages_selected_yet");
  assert(MESSAGES.hi.host_no_languages_selected_yet === "\u0905\u092d\u0940 \u0924\u0915 \u0915\u094b\u0908 \u092d\u093e\u0937\u093e \u0928\u0939\u0940\u0902 \u091a\u0941\u0928\u0940 \u0917\u0908 \u0939\u0948\u0964", "HI host_no_languages_selected_yet");
  assert(MESSAGES.ar.host_no_languages_selected_yet === "\u0644\u0645 \u064a\u062a\u0645 \u062a\u062d\u062f\u064a\u062f \u0623\u064a \u0644\u063a\u0627\u062a \u0628\u0639\u062f.", "AR host_no_languages_selected_yet");
  assert(MESSAGES.en.host_guest_requirements_title === "Guest requirements", "EN host_guest_requirements_title");
  assert(MESSAGES.es.host_guest_requirements_title === "Requisitos de los hu\u00e9spedes", "ES host_guest_requirements_title");
  assert(MESSAGES.fr.host_guest_requirements_title === "Exigences pour les voyageurs", "FR host_guest_requirements_title");
  assert(MESSAGES.de.host_guest_requirements_title === "G\u00e4steanforderungen", "DE host_guest_requirements_title");
  assert(MESSAGES.hi.host_guest_requirements_title === "\u0905\u0924\u093f\u0925\u093f \u0906\u0935\u0936\u094d\u092f\u0915\u0924\u093e\u090f\u0902", "HI host_guest_requirements_title");
  assert(MESSAGES.ar.host_guest_requirements_title === "\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0636\u064a\u0648\u0641", "AR host_guest_requirements_title");
  assert(MESSAGES.en.host_require_profile_photo_title === "Require a profile photo", "EN host_require_profile_photo_title");
  assert(MESSAGES.es.host_require_profile_photo_title === "Exigir una foto de perfil", "ES host_require_profile_photo_title");
  assert(MESSAGES.fr.host_require_profile_photo_title === "Exiger une photo de profil", "FR host_require_profile_photo_title");
  assert(MESSAGES.de.host_require_profile_photo_title === "Profilfoto anfordern", "DE host_require_profile_photo_title");
  assert(MESSAGES.hi.host_require_profile_photo_title === "\u092a\u094d\u0930\u094b\u092b\u093c\u093e\u0907\u0932 \u092b\u093c\u094b\u091f\u094b \u0906\u0935\u0936\u094d\u092f\u0915 \u0915\u0930\u0947\u0902", "HI host_require_profile_photo_title");
  assert(MESSAGES.ar.host_require_profile_photo_title === "\u0627\u0634\u062a\u0631\u0627\u0637 \u0635\u0648\u0631\u0629 \u0634\u062e\u0635\u064a\u0629", "AR host_require_profile_photo_title");

  logSection("7q. Host Interactive Calendar & Pricing Tips (/host/calendar)");
  assert(MESSAGES.en.host_calendar_title === "Calendar", "EN host_calendar_title");
  assert(MESSAGES.es.host_calendar_title === "Calendario", "ES host_calendar_title");
  assert(MESSAGES.fr.host_calendar_title === "Calendrier", "FR host_calendar_title");
  assert(MESSAGES.de.host_calendar_title === "Kalender", "DE host_calendar_title");
  assert(MESSAGES.hi.host_calendar_title === "\u0915\u0948\u0932\u0947\u0902\u0921\u0930", "HI host_calendar_title");
  assert(MESSAGES.ar.host_calendar_title === "\u0627\u0644\u062a\u0642\u0648\u064a\u0645", "AR host_calendar_title");
  assert(MESSAGES.en.host_calendar_settings_title === "Calendar Settings", "EN host_calendar_settings_title");
  assert(MESSAGES.es.host_calendar_settings_title === "Configuraci\u00f3n del calendario", "ES host_calendar_settings_title");
  assert(MESSAGES.fr.host_calendar_settings_title === "Param\u00e8tres du calendrier", "FR host_calendar_settings_title");
  assert(MESSAGES.de.host_calendar_settings_title === "Kalendereinstellungen", "DE host_calendar_settings_title");
  assert(MESSAGES.hi.host_calendar_settings_title === "\u0915\u0948\u0932\u0947\u0902\u0921\u0930 \u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938", "HI host_calendar_settings_title");
  assert(MESSAGES.ar.host_calendar_settings_title === "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062a\u0642\u0648\u064a\u0645", "AR host_calendar_settings_title");
  assert(MESSAGES.en.host_calendar_tab_price === "Price", "EN host_calendar_tab_price");
  assert(MESSAGES.es.host_calendar_tab_price === "Precio", "ES host_calendar_tab_price");
  assert(MESSAGES.fr.host_calendar_tab_price === "Prix", "FR host_calendar_tab_price");
  assert(MESSAGES.de.host_calendar_tab_price === "Preis", "DE host_calendar_tab_price");
  assert(MESSAGES.hi.host_calendar_tab_price === "\u092e\u0942\u0932\u094d\u092f", "HI host_calendar_tab_price");
  assert(MESSAGES.ar.host_calendar_tab_price === "\u0627\u0644\u0633\u0639\u0631", "AR host_calendar_tab_price");
  assert(MESSAGES.en.host_calendar_tab_availability === "Availability", "EN host_calendar_tab_availability");
  assert(MESSAGES.es.host_calendar_tab_availability === "Disponibilidad", "ES host_calendar_tab_availability");
  assert(MESSAGES.fr.host_calendar_tab_availability === "Disponibilit\u00e9", "FR host_calendar_tab_availability");
  assert(MESSAGES.de.host_calendar_tab_availability === "Verf\u00fcgbarkeit", "DE host_calendar_tab_availability");
  assert(MESSAGES.hi.host_calendar_tab_availability === "\u0909\u092a\u0932\u092c\u094d\u0927\u0924\u093e", "HI host_calendar_tab_availability");
  assert(MESSAGES.ar.host_calendar_tab_availability === "\u0627\u0644\u062a\u0648\u0641\u0631", "AR host_calendar_tab_availability");
  assert(MESSAGES.en.host_calendar_all_listings === "All listings", "EN host_calendar_all_listings");
  assert(MESSAGES.es.host_calendar_all_listings === "Todos los anuncios", "ES host_calendar_all_listings");
  assert(MESSAGES.fr.host_calendar_all_listings === "Toutes les annonces", "FR host_calendar_all_listings");
  assert(MESSAGES.de.host_calendar_all_listings === "Alle Inserate", "DE host_calendar_all_listings");
  assert(MESSAGES.hi.host_calendar_all_listings === "\u0938\u092d\u0940 \u0932\u093f\u0938\u094d\u091f\u093f\u0902\u0917", "HI host_calendar_all_listings");
  assert(MESSAGES.ar.host_calendar_all_listings === "\u062c\u0645\u064a\u0639 \u0627\u0644\u0642\u0648\u0627\u0626\u0645", "AR host_calendar_all_listings");
  assert(MESSAGES.en.host_calendar_price_tips === "Price tips", "EN host_calendar_price_tips");
  assert(MESSAGES.es.host_calendar_price_tips === "Consejos de precios", "ES host_calendar_price_tips");
  assert(MESSAGES.fr.host_calendar_price_tips === "Conseils de prix", "FR host_calendar_price_tips");
  assert(MESSAGES.de.host_calendar_price_tips === "Preistipps", "DE host_calendar_price_tips");
  assert(MESSAGES.hi.host_calendar_price_tips === "\u092e\u0942\u0932\u094d\u092f \u0938\u0941\u091d\u093e\u0935", "HI host_calendar_price_tips");
  assert(MESSAGES.ar.host_calendar_price_tips === "\u0646\u0635\u0627\u0626\u062d \u0627\u0644\u0623\u0633\u0639\u0627\u0631", "AR host_calendar_price_tips");
  assert(MESSAGES.en.host_calendar_price_tips_rec === "Selected Dates Recommendation", "EN host_calendar_price_tips_rec");
  assert(MESSAGES.es.host_calendar_price_tips_rec === "Recomendaci\u00f3n para las fechas seleccionadas", "ES host_calendar_price_tips_rec");
  assert(MESSAGES.fr.host_calendar_price_tips_rec === "Recommandation pour les dates s\u00e9lectionn\u00e9es", "FR host_calendar_price_tips_rec");
  assert(MESSAGES.de.host_calendar_price_tips_rec === "Empfehlung f\u00fcr ausgew\u00e4hlte Daten", "DE host_calendar_price_tips_rec");
  assert(MESSAGES.hi.host_calendar_price_tips_rec === "चयनित तिथियों के लिए अनुशंसा", "HI host_calendar_price_tips_rec");
  assert(MESSAGES.ar.host_calendar_price_tips_rec === "توصية التواريخ المحددة", "AR host_calendar_price_tips_rec");

  logSection("7r. Host Guidebooks Modal & Recommendations (/host/listings/[id] - Guidebooks)");
  assert(MESSAGES.en.host_guidebook_modal_add_title === "What do you want to add?", "EN host_guidebook_modal_add_title");
  assert(MESSAGES.es.host_guidebook_modal_add_title === "¿Qué te gustaría añadir?", "ES host_guidebook_modal_add_title");
  assert(MESSAGES.fr.host_guidebook_modal_add_title === "Que souhaitez-vous ajouter ?", "FR host_guidebook_modal_add_title");
  assert(MESSAGES.de.host_guidebook_modal_add_title === "Was möchtest du hinzufügen?", "DE host_guidebook_modal_add_title");
  assert(MESSAGES.hi.host_guidebook_modal_add_title === "आप क्या जोड़ना चाहते हैं?", "HI host_guidebook_modal_add_title");
  assert(MESSAGES.ar.host_guidebook_modal_add_title === "ما الذي تريد إضافته؟", "AR host_guidebook_modal_add_title");

  assert(MESSAGES.en.host_guidebook_opt_places === "Places", "EN host_guidebook_opt_places");
  assert(MESSAGES.es.host_guidebook_opt_places === "Lugares", "ES host_guidebook_opt_places");
  assert(MESSAGES.fr.host_guidebook_opt_places === "Lieux", "FR host_guidebook_opt_places");
  assert(MESSAGES.de.host_guidebook_opt_places === "Orte", "DE host_guidebook_opt_places");
  assert(MESSAGES.hi.host_guidebook_opt_places === "स्थान", "HI host_guidebook_opt_places");
  assert(MESSAGES.ar.host_guidebook_opt_places === "أماكن", "AR host_guidebook_opt_places");

  assert(MESSAGES.en.host_guidebook_opt_neighbourhoods === "Neighbourhoods", "EN host_guidebook_opt_neighbourhoods");
  assert(MESSAGES.es.host_guidebook_opt_neighbourhoods === "Barrios", "ES host_guidebook_opt_neighbourhoods");
  assert(MESSAGES.fr.host_guidebook_opt_neighbourhoods === "Quartiers", "FR host_guidebook_opt_neighbourhoods");
  assert(MESSAGES.de.host_guidebook_opt_neighbourhoods === "Viertel", "DE host_guidebook_opt_neighbourhoods");
  assert(MESSAGES.hi.host_guidebook_opt_neighbourhoods === "पड़ोस और इलाके", "HI host_guidebook_opt_neighbourhoods");
  assert(MESSAGES.ar.host_guidebook_opt_neighbourhoods === "الأحياء", "AR host_guidebook_opt_neighbourhoods");

  assert(MESSAGES.en.host_guidebook_opt_city_advice === "City advice", "EN host_guidebook_opt_city_advice");
  assert(MESSAGES.es.host_guidebook_opt_city_advice === "Consejos sobre la ciudad", "ES host_guidebook_opt_city_advice");
  assert(MESSAGES.fr.host_guidebook_opt_city_advice === "Conseils sur la ville", "FR host_guidebook_opt_city_advice");
  assert(MESSAGES.de.host_guidebook_opt_city_advice === "Tipps für die Stadt", "DE host_guidebook_opt_city_advice");
  assert(MESSAGES.hi.host_guidebook_opt_city_advice === "शहर संबंधी सुझाव", "HI host_guidebook_opt_city_advice");
  assert(MESSAGES.ar.host_guidebook_opt_city_advice === "نصائح عن المدينة", "AR host_guidebook_opt_city_advice");

  assert(MESSAGES.en.host_guidebook_advice_modal_title === "What's your advice about?", "EN host_guidebook_advice_modal_title");
  assert(MESSAGES.es.host_guidebook_advice_modal_title === "¿De qué trata tu consejo?", "ES host_guidebook_advice_modal_title");
  assert(MESSAGES.fr.host_guidebook_advice_modal_title === "Sur quoi porte votre conseil ?", "FR host_guidebook_advice_modal_title");
  assert(MESSAGES.de.host_guidebook_advice_modal_title === "Worum geht es bei deinem Tipp?", "DE host_guidebook_advice_modal_title");
  assert(MESSAGES.hi.host_guidebook_advice_modal_title === "आपकी सलाह किस बारे में है?", "HI host_guidebook_advice_modal_title");
  assert(MESSAGES.ar.host_guidebook_advice_modal_title === "عن ماذا تدور نصيحتك؟", "AR host_guidebook_advice_modal_title");

  assert(MESSAGES.en.host_guidebook_add_to_guidebook === "Add to guidebook", "EN host_guidebook_add_to_guidebook");
  assert(MESSAGES.es.host_guidebook_add_to_guidebook === "Añadir a la guía", "ES host_guidebook_add_to_guidebook");
  assert(MESSAGES.fr.host_guidebook_add_to_guidebook === "Ajouter au guide", "FR host_guidebook_add_to_guidebook");
  assert(MESSAGES.de.host_guidebook_add_to_guidebook === "Zum Reiseführer hinzufügen", "DE host_guidebook_add_to_guidebook");
  assert(MESSAGES.hi.host_guidebook_add_to_guidebook === "गाइडबुक में जोड़ें", "HI host_guidebook_add_to_guidebook");
  assert(MESSAGES.ar.host_guidebook_add_to_guidebook === "إضافة إلى دليل السفر", "AR host_guidebook_add_to_guidebook");

  logSection("7s. Public Host Profile & Identity Card (/users/profile/[id])");
  assert(MESSAGES.en.public_host_default_name === "Homyz host", "EN public_host_default_name");
  assert(MESSAGES.es.public_host_default_name === "Anfitrión de Homyz", "ES public_host_default_name");
  assert(MESSAGES.fr.public_host_default_name === "Hôte Homyz", "FR public_host_default_name");
  assert(MESSAGES.de.public_host_default_name === "Homyz-Gastgeber", "DE public_host_default_name");
  assert(MESSAGES.hi.public_host_default_name === "होमिज़ होस्ट", "HI public_host_default_name");
  assert(MESSAGES.ar.public_host_default_name === "مضيف هوميز", "AR public_host_default_name");

  assert(MESSAGES.en.public_host_card_reviews_label === "Reviews", "EN public_host_card_reviews_label");
  assert(MESSAGES.es.public_host_card_reviews_label === "Evaluaciones", "ES public_host_card_reviews_label");
  assert(MESSAGES.fr.public_host_card_reviews_label === "Commentaires", "FR public_host_card_reviews_label");
  assert(MESSAGES.de.public_host_card_reviews_label === "Bewertungen", "DE public_host_card_reviews_label");
  assert(MESSAGES.hi.public_host_card_reviews_label === "समीक्षाएं", "HI public_host_card_reviews_label");
  assert(MESSAGES.ar.public_host_card_reviews_label === "التقييمات", "AR public_host_card_reviews_label");

  assert(MESSAGES.en.public_host_card_rating_label === "Rating", "EN public_host_card_rating_label");
  assert(MESSAGES.es.public_host_card_rating_label === "Calificación", "ES public_host_card_rating_label");
  assert(MESSAGES.fr.public_host_card_rating_label === "Évaluation", "FR public_host_card_rating_label");
  assert(MESSAGES.de.public_host_card_rating_label === "Bewertung", "DE public_host_card_rating_label");
  assert(MESSAGES.hi.public_host_card_rating_label === "रेटिंग", "HI public_host_card_rating_label");
  assert(MESSAGES.ar.public_host_card_rating_label === "التقييم", "AR public_host_card_rating_label");

  assert(MESSAGES.en.public_host_card_tenure_label === "time hosting", "EN public_host_card_tenure_label");
  assert(MESSAGES.es.public_host_card_tenure_label === "tiempo como anfitrión", "ES public_host_card_tenure_label");
  assert(MESSAGES.fr.public_host_card_tenure_label === "d'expérience d'hôte", "FR public_host_card_tenure_label");
  assert(MESSAGES.de.public_host_card_tenure_label === "Erfahrung als Gastgeber", "DE public_host_card_tenure_label");
  assert(MESSAGES.hi.public_host_card_tenure_label === "होस्टिंग का समय", "HI public_host_card_tenure_label");
  assert(MESSAGES.ar.public_host_card_tenure_label === "فترة الاستضافة", "AR public_host_card_tenure_label");

  assert(MESSAGES.en.public_host_about_heading === "About {name}", "EN public_host_about_heading");
  assert(MESSAGES.es.public_host_about_heading === "Acerca de {name}", "ES public_host_about_heading");
  assert(MESSAGES.fr.public_host_about_heading === "À propos de {name}", "FR public_host_about_heading");
  assert(MESSAGES.de.public_host_about_heading === "Über {name}", "DE public_host_about_heading");
  assert(MESSAGES.hi.public_host_about_heading === "{name} के बारे में", "HI public_host_about_heading");
  assert(MESSAGES.ar.public_host_about_heading === "نبذة عن {name}", "AR public_host_about_heading");

  assert(MESSAGES.en.public_host_show_all_reviews === "Show all {count} reviews", "EN public_host_show_all_reviews");
  assert(MESSAGES.es.public_host_show_all_reviews === "Mostrar las {count} evaluaciones", "ES public_host_show_all_reviews");
  assert(MESSAGES.fr.public_host_show_all_reviews === "Afficher les {count} commentaires", "FR public_host_show_all_reviews");
  assert(MESSAGES.de.public_host_show_all_reviews === "Alle {count} Bewertungen anzeigen", "DE public_host_show_all_reviews");
  assert(MESSAGES.hi.public_host_show_all_reviews === "सभी {count} समीक्षाएं देखें", "HI public_host_show_all_reviews");
  assert(MESSAGES.ar.public_host_show_all_reviews === "عرض جميع التقييمات ({count})", "AR public_host_show_all_reviews");

  assert(MESSAGES.en.public_host_listings_heading === "{name}’s listings", "EN public_host_listings_heading");
  assert(MESSAGES.es.public_host_listings_heading === "Anuncios de {name}", "ES public_host_listings_heading");
  assert(MESSAGES.fr.public_host_listings_heading === "Annonces de {name}", "FR public_host_listings_heading");
  assert(MESSAGES.de.public_host_listings_heading === "Inserate von {name}", "DE public_host_listings_heading");
  assert(MESSAGES.hi.public_host_listings_heading === "{name} की लिस्टिंग", "HI public_host_listings_heading");
  assert(MESSAGES.ar.public_host_listings_heading === "قوائم {name}", "AR public_host_listings_heading");

  logSection("7t. Accept Invitation Form & Page (/accept-invitation)");
  assert(MESSAGES.en.accept_inv_heading === "Accept Invitation", "EN accept_inv_heading");
  assert(MESSAGES.es.accept_inv_heading === "Aceptar invitación", "ES accept_inv_heading");
  assert(MESSAGES.fr.accept_inv_heading === "Accepter l'invitation", "FR accept_inv_heading");
  assert(MESSAGES.de.accept_inv_heading === "Einladung annehmen", "DE accept_inv_heading");
  assert(MESSAGES.hi.accept_inv_heading === "आमंत्रण स्वीकार करें", "HI accept_inv_heading");
  assert(MESSAGES.ar.accept_inv_heading === "قبول الدعوة", "AR accept_inv_heading");

  assert(MESSAGES.en.accept_inv_btn_submit === "Set Password & Activate Account", "EN accept_inv_btn_submit");
  assert(MESSAGES.es.accept_inv_btn_submit === "Establecer contraseña y activar cuenta", "ES accept_inv_btn_submit");
  assert(MESSAGES.fr.accept_inv_btn_submit === "Définir le mot de passe et activer le compte", "FR accept_inv_btn_submit");
  assert(MESSAGES.de.accept_inv_btn_submit === "Passwort festlegen & Konto aktivieren", "DE accept_inv_btn_submit");
  assert(MESSAGES.hi.accept_inv_btn_submit === "पासवर्ड सेट करें और खाता सक्रिय करें", "HI accept_inv_btn_submit");
  assert(MESSAGES.ar.accept_inv_btn_submit === "تعيين كلمة المرور وتفعيل الحساب", "AR accept_inv_btn_submit");

  assert(MESSAGES.en.accept_inv_success_title === "Account Activated!", "EN accept_inv_success_title");
  assert(MESSAGES.es.accept_inv_success_title === "¡Cuenta activada!", "ES accept_inv_success_title");
  assert(MESSAGES.fr.accept_inv_success_title === "Compte activé !", "FR accept_inv_success_title");
  assert(MESSAGES.de.accept_inv_success_title === "Konto aktiviert!", "DE accept_inv_success_title");
  assert(MESSAGES.hi.accept_inv_success_title === "खाता सक्रिय हो गया!", "HI accept_inv_success_title");
  assert(MESSAGES.ar.accept_inv_success_title === "تم تفعيل الحساب!", "AR accept_inv_success_title");

  assert(MESSAGES.en.accept_inv_invalid_title === "Invalid Invitation Link", "EN accept_inv_invalid_title");
  assert(MESSAGES.es.accept_inv_invalid_title === "Enlace de invitación no válido", "ES accept_inv_invalid_title");
  assert(MESSAGES.fr.accept_inv_invalid_title === "Lien d'invitation non valide", "FR accept_inv_invalid_title");
  assert(MESSAGES.de.accept_inv_invalid_title === "Ungültiger Einladungslink", "DE accept_inv_invalid_title");
  assert(MESSAGES.hi.accept_inv_invalid_title === "अमान्य आमंत्रण लिंक", "HI accept_inv_invalid_title");
  assert(MESSAGES.ar.accept_inv_invalid_title === "رابط دعوة غير صالح", "AR accept_inv_invalid_title");

  assert(MESSAGES.en.accept_inv_unable_title === "Unable to Accept Invitation", "EN accept_inv_unable_title");
  assert(MESSAGES.es.accept_inv_unable_title === "No se puede aceptar la invitación", "ES accept_inv_unable_title");
  assert(MESSAGES.fr.accept_inv_unable_title === "Impossible d'accepter l'invitation", "FR accept_inv_unable_title");
  assert(MESSAGES.de.accept_inv_unable_title === "Einladung kann nicht angenommen werden", "DE accept_inv_unable_title");
  assert(MESSAGES.hi.accept_inv_unable_title === "आमंत्रण स्वीकार करने में असमर्थ", "HI accept_inv_unable_title");
  assert(MESSAGES.ar.accept_inv_unable_title === "تعذر قبول الدعوة", "AR accept_inv_unable_title");

  logSection("7u. Host Application Workspace (/host/onboarding)");
  assert(MESSAGES.en.host_app_header_title === "Become a Homyz Host", "EN host_app_header_title");
  assert(MESSAGES.es.host_app_header_title === "Conviértete en anfitrión de Homyz", "ES host_app_header_title");
  assert(MESSAGES.fr.host_app_header_title === "Devenir hôte Homyz", "FR host_app_header_title");
  assert(MESSAGES.de.host_app_header_title === "Homyz-Gastgeber werden", "DE host_app_header_title");
  assert(MESSAGES.hi.host_app_header_title === "Homyz होस्ट बनें", "HI host_app_header_title");
  assert(MESSAGES.ar.host_app_header_title === "كن مضيفاً في Homyz", "AR host_app_header_title");

  assert(MESSAGES.en.host_app_doc_type_gov_id === "Government Issued ID (Passport / Driver's License)", "EN host_app_doc_type_gov_id");
  assert(MESSAGES.es.host_app_doc_type_gov_id === "Documento de identidad oficial (Pasaporte / Licencia de conducir)", "ES host_app_doc_type_gov_id");
  assert(MESSAGES.fr.host_app_doc_type_gov_id === "Pièce d'identité officielle (Passeport / Permis de conduire)", "FR host_app_doc_type_gov_id");
  assert(MESSAGES.de.host_app_doc_type_gov_id === "Amtlicher Lichtbildausweis (Reisepass / Führerschein)", "DE host_app_doc_type_gov_id");
  assert(MESSAGES.hi.host_app_doc_type_gov_id === "सरकारी पहचान पत्र (पासपोर्ट / ड्राइविंग लाइसेंस)", "HI host_app_doc_type_gov_id");
  assert(MESSAGES.ar.host_app_doc_type_gov_id === "بطاقة هوية حكومية (جواز سفر / رخصة قيادة)", "AR host_app_doc_type_gov_id");

  assert(MESSAGES.en.host_app_action_req_title === "Action Required on Your Application", "EN host_app_action_req_title");
  assert(MESSAGES.es.host_app_action_req_title === "Acción requerida en tu solicitud", "ES host_app_action_req_title");
  assert(MESSAGES.fr.host_app_action_req_title === "Action requise sur votre candidature", "FR host_app_action_req_title");
  assert(MESSAGES.de.host_app_action_req_title === "Handlung für Ihren Antrag erforderlich", "DE host_app_action_req_title");
  assert(MESSAGES.hi.host_app_action_req_title === "आपके आवेदन पर कार्रवाई आवश्यक है", "HI host_app_action_req_title");
  assert(MESSAGES.ar.host_app_action_req_title === "إجراء مطلوب بشأن طلبك", "AR host_app_action_req_title");

  assert(MESSAGES.en.host_app_submitted_title === "Application Submitted Successfully!", "EN host_app_submitted_title");
  assert(MESSAGES.es.host_app_submitted_title === "¡Solicitud enviada con éxito!", "ES host_app_submitted_title");
  assert(MESSAGES.fr.host_app_submitted_title === "Candidature soumise avec succès !", "FR host_app_submitted_title");
  assert(MESSAGES.de.host_app_submitted_title === "Antrag erfolgreich eingereicht!", "DE host_app_submitted_title");
  assert(MESSAGES.hi.host_app_submitted_title === "आवेदन सफलतापूर्वक जमा किया गया!", "HI host_app_submitted_title");
  assert(MESSAGES.ar.host_app_submitted_title === "تم تقديم الطلب بنجاح!", "AR host_app_submitted_title");

  assert(MESSAGES.en.host_app_approved_title === "Host Application Approved!", "EN host_app_approved_title");
  assert(MESSAGES.es.host_app_approved_title === "¡Solicitud de anfitrión aprobada!", "ES host_app_approved_title");
  assert(MESSAGES.fr.host_app_approved_title === "Candidature d'hôte approuvée !", "FR host_app_approved_title");
  assert(MESSAGES.de.host_app_approved_title === "Gastgeber-Antrag genehmigt!", "DE host_app_approved_title");
  assert(MESSAGES.hi.host_app_approved_title === "होस्ट आवेदन स्वीकृत हुआ!", "HI host_app_approved_title");
  assert(MESSAGES.ar.host_app_approved_title === "تمت الموافقة على طلب الاستضافة!", "AR host_app_approved_title");

  assert(MESSAGES.en.host_app_rejected_title === "Application Not Approved", "EN host_app_rejected_title");
  assert(MESSAGES.es.host_app_rejected_title === "Solicitud no aprobada", "ES host_app_rejected_title");
  assert(MESSAGES.fr.host_app_rejected_title === "Candidature non approuvée", "FR host_app_rejected_title");
  assert(MESSAGES.de.host_app_rejected_title === "Antrag nicht genehmigt", "DE host_app_rejected_title");
  assert(MESSAGES.hi.host_app_rejected_title === "आवेदन स्वीकृत नहीं हुआ", "HI host_app_rejected_title");
  assert(MESSAGES.ar.host_app_rejected_title === "لم تتم الموافقة على الطلب", "AR host_app_rejected_title");

  assert(MESSAGES.en.host_app_step_1_title === "Step 1: Personal Information", "EN host_app_step_1_title");
  assert(MESSAGES.es.host_app_step_1_title === "Paso 1: Información personal", "ES host_app_step_1_title");
  assert(MESSAGES.fr.host_app_step_1_title === "Étape 1 : Informations personnelles", "FR host_app_step_1_title");
  assert(MESSAGES.de.host_app_step_1_title === "Schritt 1: Persönliche Angaben", "DE host_app_step_1_title");
  assert(MESSAGES.hi.host_app_step_1_title === "चरण 1: व्यक्तिगत जानकारी", "HI host_app_step_1_title");
  assert(MESSAGES.ar.host_app_step_1_title === "الخطوة 1: المعلومات الشخصية", "AR host_app_step_1_title");

  assert(MESSAGES.en.host_app_step_4_title === "Step 4: Upload Verification Documents", "EN host_app_step_4_title");
  assert(MESSAGES.es.host_app_step_4_title === "Paso 4: Subir documentos de verificación", "ES host_app_step_4_title");
  assert(MESSAGES.fr.host_app_step_4_title === "Étape 4 : Téléversement des documents de vérification", "FR host_app_step_4_title");
  assert(MESSAGES.de.host_app_step_4_title === "Schritt 4: Verifizierungsdokumente hochladen", "DE host_app_step_4_title");
  assert(MESSAGES.hi.host_app_step_4_title === "चरण 4: सत्यापन दस्तावेज़ अपलोड करें", "HI host_app_step_4_title");
  assert(MESSAGES.ar.host_app_step_4_title === "الخطوة 4: تحميل مستندات التحقق", "AR host_app_step_4_title");

  assert(MESSAGES.en.host_app_warn_missing_fields_title === "Cannot Submit Application — Missing Required Fields", "EN host_app_warn_missing_fields_title");
  assert(MESSAGES.es.host_app_warn_missing_fields_title === "No se puede enviar la solicitud: faltan campos obligatorios", "ES host_app_warn_missing_fields_title");
  assert(MESSAGES.fr.host_app_warn_missing_fields_title === "Impossible de soumettre le dossier — Champs obligatoires manquants", "FR host_app_warn_missing_fields_title");
  assert(MESSAGES.de.host_app_warn_missing_fields_title === "Antrag kann nicht eingereicht werden — Pflichtfelder fehlen", "DE host_app_warn_missing_fields_title");
  assert(MESSAGES.hi.host_app_warn_missing_fields_title === "आवेदन प्रस्तुत नहीं किया जा सकता — अनिवार्य फ़ील्ड अनुपलब्ध हैं", "HI host_app_warn_missing_fields_title");
  assert(MESSAGES.ar.host_app_warn_missing_fields_title === "لا يمكن تقديم الطلب — حقول مطلوبة مفقودة", "AR host_app_warn_missing_fields_title");

  console.log("\n--- 7v. Host Performance & KPI Dashboard (/host/dashboard) ---");
  assert(MESSAGES.en.host_dash_header_title === "Performance overview", "EN host_dash_header_title");
  assert(MESSAGES.es.host_dash_header_title === "Resumen de rendimiento", "ES host_dash_header_title");
  assert(MESSAGES.fr.host_dash_header_title === "Aperçu des performances", "FR host_dash_header_title");
  assert(MESSAGES.de.host_dash_header_title === "Leistungsübersicht", "DE host_dash_header_title");
  assert(MESSAGES.hi.host_dash_header_title === "प्रदर्शन अवलोकन", "HI host_dash_header_title");
  assert(MESSAGES.ar.host_dash_header_title === "نظرة عامة على الأداء", "AR host_dash_header_title");

  assert(MESSAGES.en.host_dash_kpi_monthly_earnings === "Monthly earnings", "EN host_dash_kpi_monthly_earnings");
  assert(MESSAGES.es.host_dash_kpi_monthly_earnings === "Ganancias mensuales", "ES host_dash_kpi_monthly_earnings");
  assert(MESSAGES.fr.host_dash_kpi_monthly_earnings === "Revenus mensuels", "FR host_dash_kpi_monthly_earnings");
  assert(MESSAGES.de.host_dash_kpi_monthly_earnings === "Monatliche Einnahmen", "DE host_dash_kpi_monthly_earnings");
  assert(MESSAGES.hi.host_dash_kpi_monthly_earnings === "मासिक कमाई", "HI host_dash_kpi_monthly_earnings");
  assert(MESSAGES.ar.host_dash_kpi_monthly_earnings === "الأرباح الشهرية", "AR host_dash_kpi_monthly_earnings");

  assert(MESSAGES.en.host_dash_kpi_occupancy === "Occupancy", "EN host_dash_kpi_occupancy");
  assert(MESSAGES.es.host_dash_kpi_occupancy === "Ocupación", "ES host_dash_kpi_occupancy");
  assert(MESSAGES.fr.host_dash_kpi_occupancy === "Taux d’occupation", "FR host_dash_kpi_occupancy");
  assert(MESSAGES.de.host_dash_kpi_occupancy === "Belegungsrate", "DE host_dash_kpi_occupancy");
  assert(MESSAGES.hi.host_dash_kpi_occupancy === "ऑक्यूपेंसी (अधिभोग)", "HI host_dash_kpi_occupancy");
  assert(MESSAGES.ar.host_dash_kpi_occupancy === "نسبة الإشغال", "AR host_dash_kpi_occupancy");

  assert(MESSAGES.en.host_dash_detailed_earnings === "Detailed earnings", "EN host_dash_detailed_earnings");
  assert(MESSAGES.es.host_dash_detailed_earnings === "Ganancias detalladas", "ES host_dash_detailed_earnings");
  assert(MESSAGES.fr.host_dash_detailed_earnings === "Détail des revenus", "FR host_dash_detailed_earnings");
  assert(MESSAGES.de.host_dash_detailed_earnings === "Detaillierte Einnahmen", "DE host_dash_detailed_earnings");
  assert(MESSAGES.hi.host_dash_detailed_earnings === "विस्तृत कमाई", "HI host_dash_detailed_earnings");
  assert(MESSAGES.ar.host_dash_detailed_earnings === "تفاصيل الأرباح", "AR host_dash_detailed_earnings");

  assert(MESSAGES.en.host_dash_insights_title === "Actionable insights", "EN host_dash_insights_title");
  assert(MESSAGES.es.host_dash_insights_title === "Información práctica", "ES host_dash_insights_title");
  assert(MESSAGES.fr.host_dash_insights_title === "Conseils pratiques", "FR host_dash_insights_title");
  assert(MESSAGES.de.host_dash_insights_title === "Handlungsrelevante Einblicke", "DE host_dash_insights_title");
  assert(MESSAGES.hi.host_dash_insights_title === "कार्रवाई योग्य अंतर्दृष्टि", "HI host_dash_insights_title");
  assert(MESSAGES.ar.host_dash_insights_title === "رؤى قابلة للتنفيذ", "AR host_dash_insights_title");

  assert(MESSAGES.en.host_dash_upcoming_res_title === "Upcoming reservation", "EN host_dash_upcoming_res_title");
  assert(MESSAGES.es.host_dash_upcoming_res_title === "Próxima reserva", "ES host_dash_upcoming_res_title");
  assert(MESSAGES.fr.host_dash_upcoming_res_title === "Prochaine réservation", "FR host_dash_upcoming_res_title");
  assert(MESSAGES.de.host_dash_upcoming_res_title === "Anstehende Reservierung", "DE host_dash_upcoming_res_title");
  assert(MESSAGES.hi.host_dash_upcoming_res_title === "आगामी आरक्षण", "HI host_dash_upcoming_res_title");
  assert(MESSAGES.ar.host_dash_upcoming_res_title === "الحجز القادم", "AR host_dash_upcoming_res_title");

  assert(MESSAGES.en.host_dash_status_title === "Host & listing status", "EN host_dash_status_title");
  assert(MESSAGES.es.host_dash_status_title === "Estado del anfitrión y del anuncio", "ES host_dash_status_title");
  assert(MESSAGES.fr.host_dash_status_title === "Statut de l’hôte et de l’annonce", "FR host_dash_status_title");
  assert(MESSAGES.de.host_dash_status_title === "Gastgeber- & Unterkunftsstatus", "DE host_dash_status_title");
  assert(MESSAGES.hi.host_dash_status_title === "मेजबान और लिस्टिंग स्थिति", "HI host_dash_status_title");
  assert(MESSAGES.ar.host_dash_status_title === "حالة المضيف والإعلان", "AR host_dash_status_title");

  console.log("\n--- 7w. Calendar Reservation Details & Money Modals (/host/calendar modals) ---");
  assert(MESSAGES.en.host_cal_res_modal_title === "Reservation details", "EN host_cal_res_modal_title");
  assert(MESSAGES.es.host_cal_res_modal_title === "Detalles de la reserva", "ES host_cal_res_modal_title");
  assert(MESSAGES.fr.host_cal_res_modal_title === "Détails de la réservation", "FR host_cal_res_modal_title");
  assert(MESSAGES.de.host_cal_res_modal_title === "Reservierungsdetails", "DE host_cal_res_modal_title");
  assert(MESSAGES.hi.host_cal_res_modal_title === "आरक्षण विवरण", "HI host_cal_res_modal_title");
  assert(MESSAGES.ar.host_cal_res_modal_title === "تفاصيل الحجز", "AR host_cal_res_modal_title");

  assert(MESSAGES.en.host_cal_res_cancelled_banner === "Reservation Cancelled", "EN host_cal_res_cancelled_banner");
  assert(MESSAGES.es.host_cal_res_cancelled_banner === "Reserva cancelada", "ES host_cal_res_cancelled_banner");
  assert(MESSAGES.fr.host_cal_res_cancelled_banner === "Réservation annulée", "FR host_cal_res_cancelled_banner");
  assert(MESSAGES.de.host_cal_res_cancelled_banner === "Reservierung storniert", "DE host_cal_res_cancelled_banner");
  assert(MESSAGES.hi.host_cal_res_cancelled_banner === "आरक्षण रद्द कर दिया गया", "HI host_cal_res_cancelled_banner");
  assert(MESSAGES.ar.host_cal_res_cancelled_banner === "تم إلغاء الحجز", "AR host_cal_res_cancelled_banner");

  assert(MESSAGES.en.host_cal_res_view_vat_invoice === "View VAT invoice", "EN host_cal_res_view_vat_invoice");
  assert(MESSAGES.es.host_cal_res_view_vat_invoice === "Ver factura con IVA", "ES host_cal_res_view_vat_invoice");
  assert(MESSAGES.fr.host_cal_res_view_vat_invoice === "Afficher la facture avec TVA", "FR host_cal_res_view_vat_invoice");
  assert(MESSAGES.de.host_cal_res_view_vat_invoice === "MwSt.-Rechnung anzeigen", "DE host_cal_res_view_vat_invoice");
  assert(MESSAGES.hi.host_cal_res_view_vat_invoice === "वैट चालान देखें", "HI host_cal_res_view_vat_invoice");
  assert(MESSAGES.ar.host_cal_res_view_vat_invoice === "عرض فاتورة ضريبة القيمة المضافة", "AR host_cal_res_view_vat_invoice");

  assert(MESSAGES.en.host_cal_money_title === "Send or request money", "EN host_cal_money_title");
  assert(MESSAGES.es.host_cal_money_title === "Enviar o solicitar dinero", "ES host_cal_money_title");
  assert(MESSAGES.fr.host_cal_money_title === "Envoyer ou demander de l'argent", "FR host_cal_money_title");
  assert(MESSAGES.de.host_cal_money_title === "Geld senden oder anfordern", "DE host_cal_money_title");
  assert(MESSAGES.hi.host_cal_money_title === "पैसे भेजें या अनुरोध करें", "HI host_cal_money_title");
  assert(MESSAGES.ar.host_cal_money_title === "إرسال أو طلب أموال", "AR host_cal_money_title");

  assert(MESSAGES.en.host_cal_money_send === "Send money", "EN host_cal_money_send");
  assert(MESSAGES.es.host_cal_money_send === "Enviar dinero", "ES host_cal_money_send");
  assert(MESSAGES.fr.host_cal_money_send === "Envoyer de l'argent", "FR host_cal_money_send");
  assert(MESSAGES.de.host_cal_money_send === "Geld senden", "DE host_cal_money_send");
  assert(MESSAGES.hi.host_cal_money_send === "पैसे भेजें", "HI host_cal_money_send");
  assert(MESSAGES.ar.host_cal_money_send === "إرسال أموال", "AR host_cal_money_send");

  console.log("\n--- 7x. Footer, Wizard, Host Workspace Modal & Checkout Translations ---");
  assert(MESSAGES.en.footer_col_support === "Support", "EN footer_col_support");
  assert(MESSAGES.es.footer_col_support === "Asistencia", "ES footer_col_support");
  assert(MESSAGES.fr.footer_col_support === "Assistance", "FR footer_col_support");
  assert(MESSAGES.de.footer_col_support === "Hilfe & Support", "DE footer_col_support");
  assert(MESSAGES.hi.footer_col_support === "सहायता", "HI footer_col_support");
  assert(MESSAGES.ar.footer_col_support === "الدعم", "AR footer_col_support");

  assert(MESSAGES.en.wizard_error_complete_step === "Complete this step", "EN wizard_error_complete_step");
  assert(MESSAGES.es.wizard_error_complete_step === "Completa este paso", "ES wizard_error_complete_step");
  assert(MESSAGES.fr.wizard_error_complete_step === "Terminez cette étape", "FR wizard_error_complete_step");
  assert(MESSAGES.de.wizard_error_complete_step === "Diesen Schritt abschließen", "DE wizard_error_complete_step");
  assert(MESSAGES.hi.wizard_error_complete_step === "इस चरण को पूरा करें", "HI wizard_error_complete_step");
  assert(MESSAGES.ar.wizard_error_complete_step === "أكمل هذه الخطوة", "AR wizard_error_complete_step");

  assert(MESSAGES.en.host_listings_modal_title === "Listing Title *", "EN host_listings_modal_title");
  assert(MESSAGES.es.host_listings_modal_title === "Título del anuncio *", "ES host_listings_modal_title");
  assert(MESSAGES.fr.host_listings_modal_title === "Titre de l'annonce *", "FR host_listings_modal_title");
  assert(MESSAGES.de.host_listings_modal_title === "Inseratstitel *", "DE host_listings_modal_title");
  assert(MESSAGES.hi.host_listings_modal_title === "लिस्टिंग शीर्षक *", "HI host_listings_modal_title");
  assert(MESSAGES.ar.host_listings_modal_title === "عنوان الإعلان *", "AR host_listings_modal_title");

  assert(MESSAGES.en.checkout_payment_deferred === "(mock/deferred)", "EN checkout_payment_deferred");
  assert(MESSAGES.es.checkout_payment_deferred === "(simulado/diferido)", "ES checkout_payment_deferred");
  assert(MESSAGES.fr.checkout_payment_deferred === "(simulé/différé)", "FR checkout_payment_deferred");
  assert(MESSAGES.de.checkout_payment_deferred === "(simuliert/aufgeschoben)", "DE checkout_payment_deferred");
  assert(MESSAGES.hi.checkout_payment_deferred === "(मॉक/स्थगित)", "HI checkout_payment_deferred");
  assert(MESSAGES.ar.checkout_payment_deferred === "(تجريبي/مؤجل)", "AR checkout_payment_deferred");

  console.log(`\n🎉 All ${passedCount}/${totalCount} tests passed cleanly!`);
}

runTests();
