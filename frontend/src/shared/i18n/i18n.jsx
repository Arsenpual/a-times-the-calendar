import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  translate
} from "./i18n-catalog.js";

export {
  DEFAULT_LANGUAGE,
  MONTHS,
  MONTHS_SHORT,
  SUPPORTED_LANGUAGES,
  WEEKDAYS_FULL,
  WEEKDAYS_SHORT,
  displayYear,
  translate
} from "./i18n-catalog.js";

const LANGUAGE_STORAGE_KEY = "language";
const LanguageContext = createContext(null);

export function resolveInitialLanguage(storage = globalThis.localStorage) {
  const stored = storage?.getItem?.(LANGUAGE_STORAGE_KEY);
  return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => resolveInitialLanguage());

  useEffect(() => {
    globalThis.localStorage?.setItem?.(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
    setLanguageState(nextLanguage);
  }, []);

  const t = useCallback((key, variables) => translate(language, key, variables), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * @returns {{ language: "th"|"en", setLanguage: (lang: string) => void, t: (key: string, vars?: object) => string }}
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage() ต้องเรียกภายใต้ <LanguageProvider> เท่านั้น");
  return context;
}
