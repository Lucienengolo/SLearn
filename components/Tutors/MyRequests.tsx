import { useCallback, useEffect, useState } from 'react';
import { fetchMyTutorRequests, TutorRequestListItem } from '../../lib/tutorRequests';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type MyRequestsProps = {
  parentId: string;
  onSelectRequest: (requestId: string) => void;
  onNewRequest: () => void;
};

const STATUS_KEYS: Record<string, TranslationKey> = {
  searching: 'tutorMarketplace.myRequests.statusSearching',
  matched: 'tutorMarketplace.myRequests.statusMatched',
  cancelled: 'tutorMarketplace.myRequests.statusCancelled',
};

// Design Review D2: one row per child_identifier so a parent with multiple
// children can tell requests apart at a glance (fetchMyTutorRequests already
// sorts by child_identifier). D3: warm/actionable empty state, not a bare
// "no requests" message.
export default function MyRequests({ parentId, onSelectRequest, onNewRequest }: MyRequestsProps) {
  const { t } = useLocale();
  const [requests, setRequests] = useState<TutorRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await fetchMyTutorRequests(parentId));
    } catch {
      setError(t('tutorMarketplace.myRequests.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [parentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-warm-gray">{t('common.loadingEllipsis')}</p>;
  if (error) return <p className="text-sm text-oxblood font-medium">{error}</p>;

  return (
    <div className="max-w-[700px] font-general-sans text-ink">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-fraunces text-[24px] font-medium">{t('tutorMarketplace.myRequests.title')}</h1>
        <button
          onClick={onNewRequest}
          className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover text-white font-semibold text-sm rounded-lg transition-colors"
        >
          {t('tutorMarketplace.myRequests.newRequest')}
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="border border-dashed border-ink-border rounded-lg p-8 text-center">
          <p className="text-sm font-semibold mb-1">{t('tutorMarketplace.myRequests.emptyTitle')}</p>
          <p className="text-[13px] text-warm-gray mb-4">{t('tutorMarketplace.myRequests.emptyBody')}</p>
          <button
            onClick={onNewRequest}
            className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover text-white font-semibold text-sm rounded-lg transition-colors"
          >
            {t('tutorMarketplace.myRequests.firstRequestCta')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectRequest(r.id)}
              className="text-left border border-ink-border rounded-lg p-4 hover:border-warm-gray transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{r.child_identifier ?? t('tutorMarketplace.myRequests.childUnspecified')}</span>
                <span className="text-[12px] font-plex-mono text-warm-gray">{t(STATUS_KEYS[r.status] ?? 'tutorMarketplace.myRequests.statusSearching')}</span>
              </div>
              <p className="text-[13px] text-warm-gray">
                {r.categories?.name ?? t('tutorMarketplace.subjectFallback')} · {r.grade} · {r.neighborhood} · {r.sessions_per_week}{t('tutorMarketplace.common.perWeekSuffix')}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
