import { MESSAGES, SupportedLanguage, TranslationKey } from "../lib/i18n/language-context";
import { listingTypeLabel, propertyTypeLabel } from "../lib/constants/listing-enums";

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
  assert(MESSAGES.hi.host_cancel === "रद्द करें", "HI host_cancel");

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
  // 4m. Host Listings Page & Creation Flow
  assert(MESSAGES.en.host_listings_title === "Your listings", "EN host_listings_title");
  assert(MESSAGES.es.host_listings_title === "Tus anuncios", "ES host_listings_title");
  assert(MESSAGES.fr.host_listings_title === "Vos annonces", "FR host_listings_title");
  assert(MESSAGES.de.host_listings_title === "Ihre Inserate", "DE host_listings_title");
  assert(MESSAGES.hi.host_listings_title === "आपकी लिस्टिंग", "HI host_listings_title");
  assert(MESSAGES.ar.host_listings_title === "إدراجاتك", "AR host_listings_title");

  assert(MESSAGES.en.host_tell_us_about_your_place === "Tell us about your place", "EN host_tell_us_about_your_place");
  assert(MESSAGES.es.host_tell_us_about_your_place === "Háblanos de tu alojamiento", "ES host_tell_us_about_your_place");
  assert(MESSAGES.fr.host_tell_us_about_your_place === "Parlez-nous de votre logement", "FR host_tell_us_about_your_place");
  assert(MESSAGES.de.host_tell_us_about_your_place === "Erzählen Sie uns von Ihrer Unterkunft", "DE host_tell_us_about_your_place");
  assert(MESSAGES.hi.host_tell_us_about_your_place === "हमें अपने स्थान के बारे में बताएं", "HI host_tell_us_about_your_place");
  // 4n. Co-host page translations
  assert(MESSAGES.en.host_cohost_title === "Co-hosts", "EN host_cohost_title");
  assert(MESSAGES.ar.host_cohost_title === "المضيفون المشاركون", "AR host_cohost_title");
  assert(MESSAGES.es.host_cohost_title === "Coanfitriones", "ES host_cohost_title");
  assert(MESSAGES.fr.host_cohost_title === "Co-hôtes", "FR host_cohost_title");
  assert(MESSAGES.de.host_cohost_title === "Co-Gastgeber", "DE host_cohost_title");
  assert(MESSAGES.hi.host_cohost_title === "सह-मेजबान", "HI host_cohost_title");

  assert(MESSAGES.en.host_cohost_modal_title === "Add your co-host's info", "EN host_cohost_modal_title");
  assert(MESSAGES.ar.host_cohost_modal_title === "أضف معلومات المضيف المشارك", "AR host_cohost_modal_title");
  assert(MESSAGES.es.host_cohost_modal_title === "Añade la información de tu coanfitrión", "ES host_cohost_modal_title");
  assert(MESSAGES.fr.host_cohost_modal_title === "Ajoutez les informations de votre co-hôte", "FR host_cohost_modal_title");
  assert(MESSAGES.de.host_cohost_modal_title === "Informationen Ihres Co-Gastgebers hinzufügen", "DE host_cohost_modal_title");
  assert(MESSAGES.hi.host_cohost_modal_title === "अपने सह-मेजबान की जानकारी जोड़ें", "HI host_cohost_modal_title");

  // 4o. Booking settings modal translations
  assert(MESSAGES.en.host_booking_turn_off_instant_title === "Turn off Instant Book?", "EN host_booking_turn_off_instant_title");
  assert(MESSAGES.ar.host_booking_turn_off_instant_title === "هل تريد إيقاف الحجز الفوري؟", "AR host_booking_turn_off_instant_title");
  assert(MESSAGES.es.host_booking_turn_off_instant_title === "¿Desactivar la Reserva inmediata?", "ES host_booking_turn_off_instant_title");
  assert(MESSAGES.fr.host_booking_turn_off_instant_title === "Désactiver la Réservation instantanée ?", "FR host_booking_turn_off_instant_title");
  assert(MESSAGES.de.host_booking_turn_off_instant_title === "Sofortbuchung ausschalten?", "DE host_booking_turn_off_instant_title");
  assert(MESSAGES.hi.host_booking_turn_off_instant_title === "इन्स्टेंट बुक बंद करें?", "HI host_booking_turn_off_instant_title");

  assert(MESSAGES.en.host_booking_custom_message_title === "Add a custom message", "EN host_booking_custom_message_title");
  assert(MESSAGES.ar.host_booking_custom_message_title === "إضافة رسالة مخصصة", "AR host_booking_custom_message_title");
  assert(MESSAGES.es.host_booking_custom_message_title === "Añadir un mensaje personalizado", "ES host_booking_custom_message_title");
  assert(MESSAGES.fr.host_booking_custom_message_title === "Ajouter un message personnalisé", "FR host_booking_custom_message_title");
  assert(MESSAGES.de.host_booking_custom_message_title === "Benutzerdefinierte Nachricht hinzufügen", "DE host_booking_custom_message_title");
  assert(MESSAGES.hi.host_booking_custom_message_title === "कस्टम संदेश जोड़ें", "HI host_booking_custom_message_title");

  // 4p. House Rules translations
  assert(MESSAGES.en.host_house_rules_desc === "Guests are expected to follow your rules and may be removed from Homyz if they don't.", "EN host_house_rules_desc");
  assert(MESSAGES.ar.host_house_rules_desc === "يُتوقع من الضيوف اتباع قواعدك وقد يتم استبعادهم من هوميز إذا لم يفعلوا ذلك.", "AR host_house_rules_desc");
  assert(MESSAGES.es.host_house_rules_desc === "Se espera que los huéspedes sigan tus normas y pueden ser eliminados de Homyz si no lo hacen.", "ES host_house_rules_desc");
  assert(MESSAGES.fr.host_house_rules_desc === "Les voyageurs doivent respecter vos règles et peuvent être retirés de Homyz s'ils ne le font pas.", "FR host_house_rules_desc");
  assert(MESSAGES.de.host_house_rules_desc === "Es wird erwartet, dass Gäste Ihre Regeln befolgen. Bei Nichtbeachtung können sie von Homyz entfernt werden.", "DE host_house_rules_desc");
  assert(MESSAGES.hi.host_house_rules_desc === "मेहमानों से आपके नियमों का पालन करने की उम्मीद की जाती है और यदि वे ऐसा नहीं करते हैं तो उन्हें होमिज़ से हटाया जा सकता है।", "HI host_house_rules_desc");

  assert(MESSAGES.en.host_additional_house_rules_modal_title === "Additional house rules", "EN host_additional_house_rules_modal_title");
  assert(MESSAGES.ar.host_additional_house_rules_modal_title === "قواعد بيت إضافية", "AR host_additional_house_rules_modal_title");
  assert(MESSAGES.es.host_additional_house_rules_modal_title === "Normas de la casa adicionales", "ES host_additional_house_rules_modal_title");
  assert(MESSAGES.fr.host_additional_house_rules_modal_title === "Règles intérieures supplémentaires", "FR host_additional_house_rules_modal_title");
  assert(MESSAGES.de.host_additional_house_rules_modal_title === "Zusätzliche Hausregeln", "DE host_additional_house_rules_modal_title");
  // 4q. Guest safety translations
  assert(MESSAGES.en.host_guest_safety_title === "Guest safety", "EN host_guest_safety_title");
  assert(MESSAGES.ar.host_guest_safety_title === "سلامة الضيوف", "AR host_guest_safety_title");
  assert(MESSAGES.es.host_guest_safety_title === "Seguridad del huésped", "ES host_guest_safety_title");
  assert(MESSAGES.fr.host_guest_safety_title === "Sécurité des voyageurs", "FR host_guest_safety_title");
  assert(MESSAGES.de.host_guest_safety_title === "Sicherheit der Gäste", "DE host_guest_safety_title");
  assert(MESSAGES.hi.host_guest_safety_title === "मेहमान सुरक्षा", "HI host_guest_safety_title");

  assert(MESSAGES.en.host_safety_devices_modal_title === "Safety devices", "EN host_safety_devices_modal_title");
  assert(MESSAGES.ar.host_safety_devices_modal_title === "أجهزة السلامة", "AR host_safety_devices_modal_title");
  assert(MESSAGES.es.host_safety_devices_modal_title === "Dispositivos de seguridad", "ES host_safety_devices_modal_title");
  assert(MESSAGES.fr.host_safety_devices_modal_title === "Dispositifs de sécurité", "FR host_safety_devices_modal_title");
  assert(MESSAGES.de.host_safety_devices_modal_title === "Sicherheitseinrichtungen", "DE host_safety_devices_modal_title");
  // 4r. Cancellation policy translations
  assert(MESSAGES.en.host_short_term_stays_title === "Short-term stays", "EN host_short_term_stays_title");
  assert(MESSAGES.ar.host_short_term_stays_title === "الإقامات قصيرة الأجل", "AR host_short_term_stays_title");
  assert(MESSAGES.es.host_short_term_stays_title === "Estancias de corta duración", "ES host_short_term_stays_title");
  assert(MESSAGES.fr.host_short_term_stays_title === "Séjours de courte durée", "FR host_short_term_stays_title");
  assert(MESSAGES.de.host_short_term_stays_title === "Kurzzeitaufenthalte", "DE host_short_term_stays_title");
  assert(MESSAGES.hi.host_short_term_stays_title === "अल्पकालिक प्रवास", "HI host_short_term_stays_title");

  assert(MESSAGES.en.host_non_refundable_option_title === "Non-refundable option", "EN host_non_refundable_option_title");
  assert(MESSAGES.ar.host_non_refundable_option_title === "خيار غير قابل للإرجاع", "AR host_non_refundable_option_title");
  assert(MESSAGES.es.host_non_refundable_option_title === "Opción no reembolsable", "ES host_non_refundable_option_title");
  assert(MESSAGES.fr.host_non_refundable_option_title === "Option non remboursable", "FR host_non_refundable_option_title");
  assert(MESSAGES.de.host_non_refundable_option_title === "Nicht erstattungsfähige Option", "DE host_non_refundable_option_title");
  assert(MESSAGES.hi.host_non_refundable_option_title === "गैर-वापसी योग्य विकल्प", "HI host_non_refundable_option_title");

  // 4s. Listing Type and Property Type sidebar translations
  assert(MESSAGES.en.host_listing_type_entire_place === "Entire place", "EN host_listing_type_entire_place");
  assert(MESSAGES.ar.host_listing_type_entire_place === "مكان بالكامل", "AR host_listing_type_entire_place");
  assert(MESSAGES.es.host_listing_type_entire_place === "Alojamiento entero", "ES host_listing_type_entire_place");
  assert(MESSAGES.fr.host_listing_type_entire_place === "Logement entier", "FR host_listing_type_entire_place");
  assert(MESSAGES.de.host_listing_type_entire_place === "Gesamte Unterkunft", "DE host_listing_type_entire_place");
  assert(MESSAGES.hi.host_listing_type_entire_place === "पूरा स्थान", "HI host_listing_type_entire_place");

  for (const lang of supportedLangs) {
    const t = (key: string) => (MESSAGES[lang] as Record<string, string>)[key] || key;
    assert(listingTypeLabel("ENTIRE_PLACE", t) !== "ENTIRE_PLACE", `[${lang}] ENTIRE_PLACE listing type label localized`);
    assert(propertyTypeLabel("HOUSE", t) !== "HOUSE", `[${lang}] HOUSE property type label localized`);
    assert(propertyTypeLabel("APARTMENT", t) !== "APARTMENT", `[${lang}] APARTMENT property type label localized`);
  }

  // 4t. Sleeping arrangements page translations
  assert(MESSAGES.en.host_sleeping_arrangements_title === "Sleeping arrangements", "EN host_sleeping_arrangements_title");
  assert(MESSAGES.ar.host_sleeping_arrangements_title === "ترتيبات النوم", "AR host_sleeping_arrangements_title");
  assert(MESSAGES.es.host_sleeping_arrangements_title === "Distribución de camas", "ES host_sleeping_arrangements_title");
  assert(MESSAGES.fr.host_sleeping_arrangements_title === "Couchages", "FR host_sleeping_arrangements_title");
  assert(MESSAGES.de.host_sleeping_arrangements_title === "Schlafgelegenheiten", "DE host_sleeping_arrangements_title");
  assert(MESSAGES.hi.host_sleeping_arrangements_title === "सोने की व्यवस्था", "HI host_sleeping_arrangements_title");

  assert(MESSAGES.en.host_room_by_room_arrangements === "Room-by-room sleeping arrangements", "EN host_room_by_room_arrangements");
  assert(MESSAGES.ar.host_room_by_room_arrangements === "ترتيبات النوم غرفة بغرفة", "AR host_room_by_room_arrangements");
  assert(MESSAGES.es.host_room_by_room_arrangements === "Distribución de camas por habitación", "ES host_room_by_room_arrangements");
  assert(MESSAGES.fr.host_room_by_room_arrangements === "Couchages chambre par chambre", "FR host_room_by_room_arrangements");
  assert(MESSAGES.de.host_room_by_room_arrangements === "Schlafgelegenheiten nach Zimmern", "DE host_room_by_room_arrangements");
  assert(MESSAGES.hi.host_room_by_room_arrangements === "कमरे के अनुसार सोने की व्यवस्था", "HI host_room_by_room_arrangements");

  // 4u. Host sub-nav menu and filter button translations
  assert(MESSAGES.en.host_nav_menu === "Menu", "EN host_nav_menu");
  assert(MESSAGES.ar.host_nav_menu === "القائمة", "AR host_nav_menu");
  assert(MESSAGES.es.host_nav_menu === "Menú", "ES host_nav_menu");
  assert(MESSAGES.fr.host_nav_menu === "Menu", "FR host_nav_menu");
  assert(MESSAGES.de.host_nav_menu === "Menü", "DE host_nav_menu");
  assert(MESSAGES.hi.host_nav_menu === "मेन्यू", "HI host_nav_menu");

  assert(MESSAGES.en.host_nav_filters === "Filters", "EN host_nav_filters");
  assert(MESSAGES.ar.host_nav_filters === "الفلاتر", "AR host_nav_filters");
  assert(MESSAGES.es.host_nav_filters === "Filtros", "ES host_nav_filters");
  assert(MESSAGES.fr.host_nav_filters === "Filtres", "FR host_nav_filters");
  assert(MESSAGES.de.host_nav_filters === "Filter", "DE host_nav_filters");
  assert(MESSAGES.hi.host_nav_filters === "फ़िल्टर", "HI host_nav_filters");

  console.log(`\n🎉 All ${passedCount}/${totalCount} tests passed cleanly!`);
}

runTests();
