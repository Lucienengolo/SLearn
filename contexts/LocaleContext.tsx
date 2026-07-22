import { createContext, useContext, useState, ReactNode } from 'react';
import { Locale, TranslationKey, translate, detectDefaultLocale, loadStoredLocale, storeLocale } from '../lib/i18n';

type LocaleContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: stored preference wins, else detect-with-French-
  // fallback (D10) -- computed once, not re-detected on every render.
  const [locale, setLocaleState] = useState<Locale>(() => loadStoredLocale() ?? detectDefaultLocale());

  function setLocale(next: Locale) {
    setLocaleState(next);
    storeLocale(next);
  }

  function t(key: TranslationKey): string {
    return translate(locale, key);
  }

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
