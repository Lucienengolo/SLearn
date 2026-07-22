export type Locale = 'fr' | 'en';

const LOCALE_STORAGE_KEY = 'slearn_locale';

// Platform chrome strings only (CEO plan item 7: "for platform chrome, not
// just course content"). Tutor-marketplace screen copy (RequestForm, Chat,
// MatchStatus, PaymentStatus, AdminMetrics) is a separately tracked TODO
// (TODOS.md: "Produce actual English translations for tutor-marketplace
// screen copy") -- this dictionary intentionally does not cover it yet.
export const translations = {
  fr: {
    'nav.home': 'Accueil',
    'nav.courses': 'Cours',
    'nav.dashboard': 'Tableau de bord',
    'nav.tutors': 'Trouver un tuteur',
    'nav.reviewQueue': 'File de révision',
    'nav.accountSettings': 'Paramètres du compte',
    'nav.signIn': 'Se connecter',
    'nav.signOut': 'Se déconnecter',
    'nav.openMenu': 'Ouvrir le menu',
    'nav.closeMenu': 'Fermer le menu',
    'guest.xpLabel': 'XP invité (cette session)',
  },
  en: {
    'nav.home': 'Home',
    'nav.courses': 'Courses',
    'nav.dashboard': 'Dashboard',
    'nav.tutors': 'Find a Tutor',
    'nav.reviewQueue': 'Review queue',
    'nav.accountSettings': 'Account settings',
    'nav.signIn': 'Sign In',
    'nav.signOut': 'Sign Out',
    'nav.openMenu': 'Open menu',
    'nav.closeMenu': 'Close menu',
    'guest.xpLabel': 'guest XP (this session)',
  },
} as const;

export type TranslationKey = keyof (typeof translations)['fr'];

// Design Review D10: detect from browser/device locale, fallback to French
// -- matches the real Cameroon linguistic mix (Scope Decision #4), no
// onboarding question forced on the user.
export function detectDefaultLocale(): Locale {
  if (typeof navigator === 'undefined') return 'fr';
  const lang = navigator.language?.toLowerCase() ?? '';
  return lang.startsWith('en') ? 'en' : 'fr';
}

export function loadStoredLocale(): Locale | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === 'fr' || stored === 'en' ? stored : null;
}

export function storeLocale(locale: Locale): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function translate(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}
