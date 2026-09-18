import { MESSAGES, SupportedLanguage, TranslationKey } from "../lib/i18n/language-context";

function runTests() {
  console.log("=== Running Language Translation Test Suite ===");
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, message: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ ${message}`);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Test failed: ${message}`);
    }
  }

  // Test 1: Supported Languages List
  const supportedLangs: SupportedLanguage[] = ["en", "es", "fr", "de", "hi", "ar"];
  assert(supportedLangs.length === 6, "Supported languages count must be 6");

  // Test 2: Check all translation keys exist for English (reference)
  const enKeys = Object.keys(MESSAGES.en) as TranslationKey[];
  assert(enKeys.length > 0, `English dictionary should have keys (found ${enKeys.length})`);

  // Test 3: Every language has every translation key non-empty
  for (const lang of supportedLangs) {
    const langDict = MESSAGES[lang];
    assert(!!langDict, `Translations for '${lang}' must exist`);

    for (const key of enKeys) {
      const val = langDict[key];
      assert(
        typeof val === "string" && val.trim().length > 0,
        `[${lang}] Key '${key}' must have a non-empty string value (got: "${val}")`
      );
    }
  }

  // Test 4: Specific string verifications across languages
  // 4a. Header
  assert(MESSAGES.en.header_become_a_host === "Become a host", "EN header_become_a_host");
  assert(MESSAGES.es.header_become_a_host === "Hazte anfitrión", "ES header_become_a_host");
  assert(MESSAGES.fr.header_become_a_host === "Devenir hôte", "FR header_become_a_host");
  assert(MESSAGES.de.header_become_a_host === "Gastgeber werden", "DE header_become_a_host");
  assert(MESSAGES.hi.header_become_a_host === "होस्ट बनें", "HI header_become_a_host");
  assert(MESSAGES.ar.header_become_a_host === "كن مضيفاً", "AR header_become_a_host");

  // 4b. Auth Form Labels
  assert(MESSAGES.en.auth_email_address === "Email address", "EN auth_email_address");
  assert(MESSAGES.es.auth_email_address === "Correo electrónico", "ES auth_email_address");
  assert(MESSAGES.fr.auth_email_address === "Adresse e-mail", "FR auth_email_address");
  assert(MESSAGES.de.auth_email_address === "E-Mail-Adresse", "DE auth_email_address");
  assert(MESSAGES.hi.auth_email_address === "ईमेल पता", "HI auth_email_address");
  assert(MESSAGES.ar.auth_email_address === "البريد الإلكتروني", "AR auth_email_address");

  // 4c. Forgot Password
  assert(MESSAGES.en.auth_send_reset_link === "Send Reset Link", "EN auth_send_reset_link");
  assert(MESSAGES.es.auth_send_reset_link === "Enviar enlace de restablecimiento", "ES auth_send_reset_link");
  assert(MESSAGES.hi.auth_send_reset_link === "रीसेट लिंक भेजें", "HI auth_send_reset_link");

  // 4d. Host Onboarding Modal
  assert(MESSAGES.en.host_what_would_you_like_to_host === "What would you like to host?", "EN host_what_would_you_like_to_host");
  assert(MESSAGES.es.host_what_would_you_like_to_host === "¿Qué te gustaría hospedar?", "ES host_what_would_you_like_to_host");
  assert(MESSAGES.fr.host_what_would_you_like_to_host === "Que souhaitez-vous héberger ?", "FR host_what_would_you_like_to_host");
  assert(MESSAGES.de.host_what_would_you_like_to_host === "Was möchten Sie anbieten?", "DE host_what_would_you_like_to_host");
  assert(MESSAGES.hi.host_what_would_you_like_to_host === "आप क्या होस्ट करना चाहते हैं?", "HI host_what_would_you_like_to_host");
  // 4e. Reset Password
  assert(MESSAGES.en.auth_reset_title === "Reset Password", "EN auth_reset_title");
  assert(MESSAGES.es.auth_reset_title === "Restablecer contraseña", "ES auth_reset_title");
  assert(MESSAGES.fr.auth_reset_title === "Réinitialiser le mot de passe", "FR auth_reset_title");
  assert(MESSAGES.de.auth_reset_title === "Passwort zurücksetzen", "DE auth_reset_title");
  assert(MESSAGES.hi.auth_reset_title === "पासवर्ड रीसेट करें", "HI auth_reset_title");
  // 4f. Home Page
  assert(MESSAGES.en.home_hero_title === "Book cozy stays that feel like home", "EN home_hero_title");
  assert(MESSAGES.es.home_hero_title === "Reserva alojamientos acogedores que se sientan como en casa", "ES home_hero_title");
  assert(MESSAGES.fr.home_hero_title === "Réservez des séjours chaleureux comme à la maison", "FR home_hero_title");
  assert(MESSAGES.de.home_hero_title === "Buchen Sie gemütliche Unterkünfte wie zu Hause", "DE home_hero_title");
  assert(MESSAGES.hi.home_hero_title === "घर जैसा अनुभव देने वाले आरामदायक आवास बुक करें", "HI home_hero_title");
  assert(MESSAGES.ar.home_hero_title === "احجز إقامات مريحة تمنحك شعور المنزل", "AR home_hero_title");

  // 4g. Who Section
  assert(MESSAGES.en.home_whos_coming === "Who's coming?", "EN home_whos_coming");
  assert(MESSAGES.es.home_whos_coming === "¿Quién viene?", "ES home_whos_coming");
  assert(MESSAGES.fr.home_whos_coming === "Qui vient ?", "FR home_whos_coming");
  assert(MESSAGES.de.home_whos_coming === "Wer kommt mit?", "DE home_whos_coming");
  assert(MESSAGES.hi.home_whos_coming === "कौन आ रहा है?", "HI home_whos_coming");
  assert(MESSAGES.ar.home_whos_coming === "من القادم؟", "AR home_whos_coming");

  // 4h. When / Calendar Section
  assert(MESSAGES.en.home_when_tab_dates === "Dates", "EN home_when_tab_dates");
  assert(MESSAGES.es.home_when_tab_dates === "Fechas", "ES home_when_tab_dates");
  assert(MESSAGES.fr.home_when_tab_dates === "Dates", "FR home_when_tab_dates");
  assert(MESSAGES.de.home_when_tab_dates === "Daten", "DE home_when_tab_dates");
  assert(MESSAGES.hi.home_when_tab_dates === "तारीखें", "HI home_when_tab_dates");
  assert(MESSAGES.ar.home_when_tab_dates === "التواريخ", "AR home_when_tab_dates");

  assert(MESSAGES.en.home_when_trip === "When's your trip?", "EN home_when_trip");
  assert(MESSAGES.es.home_when_trip === "¿Cuándo es tu viaje?", "ES home_when_trip");
  assert(MESSAGES.fr.home_when_trip === "Quand a lieu votre voyage ?", "FR home_when_trip");
  assert(MESSAGES.de.home_when_trip === "Wann ist Ihre Reise?", "DE home_when_trip");
  assert(MESSAGES.hi.home_when_trip === "आपकी यात्रा कब है?", "HI home_when_trip");
  assert(MESSAGES.ar.home_when_trip === "متى رحلتك؟", "AR home_when_trip");

  // 4i. Homepage Property Section Titles
  assert(MESSAGES.en.home_section_featured_stays === "Featured stays", "EN home_section_featured_stays");
  assert(MESSAGES.es.home_section_featured_stays === "Alojamientos destacados", "ES home_section_featured_stays");
  assert(MESSAGES.fr.home_section_featured_stays === "Séjours en vedette", "FR home_section_featured_stays");
  assert(MESSAGES.de.home_section_featured_stays === "Empfohlene Unterkünfte", "DE home_section_featured_stays");
  assert(MESSAGES.hi.home_section_featured_stays === "विशेष आवास", "HI home_section_featured_stays");
  assert(MESSAGES.ar.home_section_featured_stays === "إقامات مميزة", "AR home_section_featured_stays");

  assert(MESSAGES.en.home_section_available_weekend === "Available this weekend", "EN home_section_available_weekend");
  assert(MESSAGES.es.home_section_available_weekend === "Disponible este fin de semana", "ES home_section_available_weekend");
  assert(MESSAGES.fr.home_section_available_weekend === "Disponible ce week-end", "FR home_section_available_weekend");
  assert(MESSAGES.de.home_section_available_weekend === "Dieses Wochenende verfügbar", "DE home_section_available_weekend");
  assert(MESSAGES.hi.home_section_available_weekend === "इस सप्ताहांत उपलब्ध", "HI home_section_available_weekend");
  assert(MESSAGES.ar.home_section_available_weekend === "متاح في عطلة نهاية الأسبوع هذه", "AR home_section_available_weekend");

  // 4j. Trending Stays & Recommended Stays
  assert(MESSAGES.en.home_section_trending_stays === "Trending stays", "EN home_section_trending_stays");
  assert(MESSAGES.es.home_section_trending_stays === "Alojamientos populares", "ES home_section_trending_stays");
  assert(MESSAGES.fr.home_section_trending_stays === "Séjours tendance", "FR home_section_trending_stays");
  assert(MESSAGES.de.home_section_trending_stays === "Beliebte Aufenthalte", "DE home_section_trending_stays");
  assert(MESSAGES.hi.home_section_trending_stays === "प्रचलित आवास", "HI home_section_trending_stays");
  assert(MESSAGES.ar.home_section_trending_stays === "إقامات شائعة", "AR home_section_trending_stays");

  assert(MESSAGES.en.home_section_recommended_stays === "Recommended stays", "EN home_section_recommended_stays");
  assert(MESSAGES.es.home_section_recommended_stays === "Estancias recomendadas", "ES home_section_recommended_stays");
  assert(MESSAGES.fr.home_section_recommended_stays === "Séjours recommandés", "FR home_section_recommended_stays");
  assert(MESSAGES.de.home_section_recommended_stays === "Empfohlene Aufenthalte", "DE home_section_recommended_stays");
  assert(MESSAGES.hi.home_section_recommended_stays === "अनुशंसित प्रवास", "HI home_section_recommended_stays");
  assert(MESSAGES.ar.home_section_recommended_stays === "إقامات موصى بها", "AR home_section_recommended_stays");

  // 4k. Additional Home Page Static Elements
  assert(MESSAGES.en.home_trending_destinations === "Trending destinations", "EN home_trending_destinations");
  assert(MESSAGES.ar.home_trending_destinations === "وجهات شائعة", "AR home_trending_destinations");
  assert(MESSAGES.en.home_recently_viewed === "Recently viewed", "EN home_recently_viewed");
  assert(MESSAGES.ar.home_recently_viewed === "شوهدت مؤخراً", "AR home_recently_viewed");
  assert(MESSAGES.en.home_continue_searching_for_homes === "Continue searching for homes", "EN home_continue_searching_for_homes");
  assert(MESSAGES.ar.home_continue_searching_for_homes === "متابعة البحث عن إقامات", "AR home_continue_searching_for_homes");

  // 4l. Homes in / Homes near section titles
  assert(MESSAGES.en.home_section_homes_in === "Homes in {location}", "EN home_section_homes_in");
  assert(MESSAGES.ar.home_section_homes_in === "إقامات في {location}", "AR home_section_homes_in");
  assert(MESSAGES.es.home_section_homes_in === "Alojamientos en {location}", "ES home_section_homes_in");
  assert(MESSAGES.fr.home_section_homes_in === "Logements à {location}", "FR home_section_homes_in");
  assert(MESSAGES.de.home_section_homes_in === "Unterkünfte in {location}", "DE home_section_homes_in");
  assert(MESSAGES.hi.home_section_homes_in === "{location} में आवास", "HI home_section_homes_in");

  console.log(`\n🎉 All ${passedCount}/${totalCount} tests passed cleanly!`);
}

runTests();
