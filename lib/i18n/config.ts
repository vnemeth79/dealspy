'use client';

import { useState, useCallback } from 'react';
import hu from './translations/hu.json';
import en from './translations/en.json';
import de from './translations/de.json';

export type Language = 'hu' | 'en' | 'de';

const translations: Record<Language, typeof hu> = {
  hu,
  en,
  de,
};

/**
 * Get a nested translation value by key path
 */
export function getTranslation(
  key: string,
  lang: Language = 'hu'
): string {
  const keys = key.split('.');
  let value: unknown = translations[lang];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      // Fallback to Hungarian if key not found
      value = translations.hu;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = (value as Record<string, unknown>)[fallbackKey];
        } else {
          return key; // Return key if not found
        }
      }
      break;
    }
  }

  return typeof value === 'string' ? value : key;
}

/**
 * Hook for using translations in components
 */
export function useTranslation(initialLang: Language = 'hu') {
  const [language, setLanguage] = useState<Language>(initialLang);

  const t = useCallback(
    (key: string): string => {
      return getTranslation(key, language);
    },
    [language]
  );

  const changeLanguage = useCallback((newLang: Language) => {
    setLanguage(newLang);
    // Optionally save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('dealspy-lang', newLang);
    }
  }, []);

  return { t, language, changeLanguage };
}

/**
 * Get initial language from browser or localStorage
 */
export function getInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'hu';
  }

  // Check localStorage first
  const saved = localStorage.getItem('dealspy-lang');
  if (saved && ['hu', 'en', 'de'].includes(saved)) {
    return saved as Language;
  }

  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (['hu', 'en', 'de'].includes(browserLang)) {
    return browserLang as Language;
  }

  return 'hu';
}

export default translations;
