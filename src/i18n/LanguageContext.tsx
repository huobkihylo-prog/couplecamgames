import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Language } from '../types/duoplay';
import { TRANSLATIONS, type TranslationDictionary } from './translations';

interface LanguageContextValue {
  lang: Language;
  dir: 'ltr' | 'rtl';
  t: TranslationDictionary;
  setLang: (lang: Language) => void;
}

const STORAGE_KEY = 'couplecam_lang';

function resolveInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'fr';
  try {
    const params = new URLSearchParams(window.location.search);
    const qLang = params.get('lang');
    if (qLang === 'fr' || qLang === 'en' || qLang === 'ar') {
      return qLang;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en' || saved === 'ar') {
      return saved;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return 'fr';
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'fr',
  dir: 'ltr',
  t: TRANSLATIONS.fr,
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(resolveInitialLanguage);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    const dict = TRANSLATIONS[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = dict.dir;
  }, [lang]);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        dir: TRANSLATIONS[lang].dir,
        t: TRANSLATIONS[lang],
        setLang,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n(): LanguageContextValue {
  return useContext(LanguageContext);
}
