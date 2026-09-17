"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { NextIntlClientProvider, createTranslator } from "next-intl";

import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import frMessages from "@/messages/fr.json";
import deMessages from "@/messages/de.json";
import hiMessages from "@/messages/hi.json";
import arMessages from "@/messages/ar.json";

export type SupportedLanguage = "en" | "es" | "fr" | "de" | "hi" | "ar";
export type TranslationKey = keyof typeof enMessages;

export const MESSAGES: Record<SupportedLanguage, Record<string, string>> = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  de: deMessages,
  hi: hiMessages,
  ar: arMessages,
};

interface LanguageContextType {
  language: SupportedLanguage;
  selectedLangLabel: string;
  setLanguage: (lang: SupportedLanguage | string) => void;
  t: (key: TranslationKey, fallback?: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("en");
  const [selectedLangLabel, setSelectedLangLabel] = useState<string>("English (US)");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("homyz_selected_language");
      if (saved) {
        applyLanguage(saved);
      }
    }
  }, []);

  const applyLanguage = (langInput: SupportedLanguage | string) => {
    let code: SupportedLanguage = "en";
    let label = "English (US)";

    if (langInput === "English (UK)") {
      code = "en";
      label = "English (UK)";
    } else if (langInput === "Español" || langInput === "es") {
      code = "es";
      label = "Español";
    } else if (langInput === "Français" || langInput === "fr") {
      code = "fr";
      label = "Français";
    } else if (langInput === "Deutsch" || langInput === "de") {
      code = "de";
      label = "Deutsch";
    } else if (langInput === "Hindi" || langInput === "hi") {
      code = "hi";
      label = "Hindi";
    } else if (langInput === "العربية" || langInput === "ar" || langInput.toLowerCase().includes("arabic")) {
      code = "ar";
      label = "العربية";
    } else {
      code = "en";
      label = "English (US)";
    }

    setLanguageState(code);
    setSelectedLangLabel(label);
    if (typeof window !== "undefined") {
      localStorage.setItem("homyz_selected_language", label);
      document.documentElement.lang = code;
      document.documentElement.dir = "ltr";
    }
  };

  const messages = MESSAGES[language] || MESSAGES.en;
  const translator = createTranslator({ locale: language, messages });

  const t = (key: TranslationKey, fallback?: string): string => {
    try {
      return translator(key);
    } catch {
      return messages[key] || MESSAGES.en[key] || fallback || key;
    }
  };

  const dir = "ltr";

  return (
    <NextIntlClientProvider locale={language} messages={messages}>
      <LanguageContext.Provider value={{ language, selectedLangLabel, setLanguage: applyLanguage, t, dir }}>
        {children}
      </LanguageContext.Provider>
    </NextIntlClientProvider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: "en" as SupportedLanguage,
      selectedLangLabel: "English (US)",
      setLanguage: () => {},
      t: (key: TranslationKey, fallback?: string) => MESSAGES.en[key] || fallback || key,
      dir: "ltr" as const,
    };
  }
  return context;
}
