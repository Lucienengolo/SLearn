import { AlertTriangle } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { LegalDocKey, LEGAL_DOCS } from '../../lib/legalDocs';
import { renderRichText } from '../../lib/richText';

type LegalDocumentProps = {
  docKey: LegalDocKey;
  onBack: () => void;
};

// Renders one of the 5 legal documents (founder request, 2026-08-01, ahead
// of the security/compliance/RLS pass gating beta testing). Reuses
// renderRichText (lib/richText.tsx) -- the same markdown-lite parser
// already used for lesson content -- instead of a second rendering path,
// since these documents use the same #/##/list structure it already
// handles. The attorney-review disclaimer lives here (one place), not
// duplicated inside every document body in lib/legalDocs.ts.
export default function LegalDocument({ docKey, onBack }: LegalDocumentProps) {
  const { t, locale } = useLocale();
  const doc = LEGAL_DOCS[docKey];
  const title = locale === 'fr' ? doc.titleFr : doc.titleEn;
  const body = locale === 'fr' ? doc.bodyFr : doc.bodyEn;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition mb-6">
        {t('legal.backButton')}
      </button>

      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-6">{title}</h1>

      <div className="flex gap-2.5 items-start bg-[#F7E9E6] border border-oxblood/30 rounded-[10px] p-4 mb-8">
        <AlertTriangle size={18} className="text-oxblood flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#5E211A]">{t('legal.draftDisclaimer')}</p>
      </div>

      <div className="prose-legal text-gray-700 text-sm leading-relaxed">{renderRichText(body)}</div>
    </div>
  );
}
