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
  assert(MESSAGES.ar.auth_reset_title === "إعادة تعيين كلمة المرور", "AR auth_reset_title");

  console.log(`\n🎉 All ${passedCount}/${totalCount} tests passed cleanly!`);
}

runTests();
