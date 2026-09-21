import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { PaperLink, fetchPaperLink } from '../../lib/spekoohMarkingRequests';
import { useLocale } from '../../contexts/LocaleContext';

type ViewerState = { kind: 'loading' } | { kind: 'ok'; link: PaperLink } | { kind: 'gone' } | { kind: 'error' };

// Shows the actual question paper next to the marking work. The link is
// fetched fresh from Spekooh every time this mounts (see fetchPaperLink) and
// is deliberately short-lived, so the view marks itself stale shortly before
// the link would die and offers a reload instead of silently going blank.
export default function SpekoohPaperViewer({ spekoohRequestId }: { spekoohRequestId: number }) {
  const { t } = useLocale();
  const [state, setState] = useState<ViewerState>({ kind: 'loading' });
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    setStale(false);
    const result = await fetchPaperLink(spekoohRequestId);
    setState(result.kind === 'ok' ? { kind: 'ok', link: result.link } : { kind: result.kind });
  }, [spekoohRequestId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state.kind !== 'ok') return;
    const timer = setTimeout(() => setStale(true), state.link.expires_in * 900);
    return () => clearTimeout(timer);
  }, [state]);

  const link = state.kind === 'ok' ? state.link : null;
  const isPdf = link?.content_type === 'application/pdf';
  const isImage = link?.content_type.startsWith('image/') ?? false;

  return (
    <section className="rounded-[14px] border border-canvas-150 shadow-sm overflow-hidden bg-white" aria-labelledby="paper-viewer-title">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-canvas-150">
        <h2 id="paper-viewer-title" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FileText size={16} className="text-primary-600" />
          {t('dashboard.marking.paperViewerTitle')}
        </h2>
        {link && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800 transition"
          >
            <ExternalLink size={14} />
            <span>{t('dashboard.marking.paperOpenNewTab')}</span>
          </a>
        )}
      </div>

      {stale && (
        <div role="status" className="flex items-center justify-between gap-3 px-4 py-2 bg-orange-50 text-orange-700 text-sm">
          <span>{t('dashboard.marking.paperStale')}</span>
          <button onClick={load} className="inline-flex items-center gap-1 font-semibold hover:underline flex-shrink-0">
            <RefreshCw size={13} />
            {t('dashboard.marking.paperReload')}
          </button>
        </div>
      )}

      <div className="bg-gray-50">
        {state.kind === 'loading' && (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-sm text-gray-500" role="status">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            {t('dashboard.marking.paperLoading')}
          </div>
        )}

        {(state.kind === 'gone' || state.kind === 'error') && (
          <div className="h-[40vh] flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-gray-600" role="alert">
            <p>{state.kind === 'gone' ? t('dashboard.marking.paperGone') : t('dashboard.marking.paperError')}</p>
            {state.kind === 'error' && (
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-primary-500 text-gray-900 font-medium hover:bg-primary-400 transition"
              >
                <RefreshCw size={14} />
                {t('dashboard.marking.tryAgain')}
              </button>
            )}
          </div>
        )}

        {link && isPdf && (
          <iframe title={t('dashboard.marking.paperViewerTitle')} src={link.url} className="w-full h-[70vh] border-0" />
        )}
        {link && isImage && (
          <div className="max-h-[70vh] overflow-auto">
            <img src={link.url} alt={t('dashboard.marking.paperViewerTitle')} className="w-full h-auto" />
          </div>
        )}
        {link && !isPdf && !isImage && (
          <div className="h-[30vh] flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-600">
            <p>{t('dashboard.marking.paperNoPreview')}</p>
            <p className="text-2xs text-gray-500">{link.file_name}</p>
          </div>
        )}
      </div>
    </section>
  );
}
