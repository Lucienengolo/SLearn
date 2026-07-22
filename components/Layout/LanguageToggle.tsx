import { useLocale } from '../../contexts/LocaleContext';

// Styled with the header's existing primary-*/gray-*/canvas-150 tokens, not
// DESIGN.md's ink/paper/oxblood system -- Header.tsx is shared, not-yet-
// ported chrome (see tailwind.config.js's porting comment), so this blends
// into how the header already looks rather than introducing a second
// visual language into one shared component.
export default function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="inline-flex border border-canvas-150 rounded-full p-0.5" role="group" aria-label="Language">
      <button
        onClick={() => setLocale('fr')}
        aria-pressed={locale === 'fr'}
        className={`text-2xs font-semibold px-2.5 py-1 rounded-full transition ${
          locale === 'fr' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        FR
      </button>
      <button
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={`text-2xs font-semibold px-2.5 py-1 rounded-full transition ${
          locale === 'en' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        EN
      </button>
    </div>
  );
}
