import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, FileText, Search } from 'lucide-react';
import {
  INBOX_BUCKETS,
  InboxBucket,
  SpekoohMarkingRequest,
  activeDeadline,
  bucketFor,
  countByBucket,
  fetchMyMarkingRequests,
  isExpired,
  paperTitle,
  timeLeft,
} from '../../lib/spekoohMarkingRequests';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';
import SpekoohEarnings from './SpekoohEarnings';
import SpekoohRequestDetail from './SpekoohRequestDetail';
import { DeadlineChip, FactChips, StatusBadge } from './spekoohShared';

const BUCKET_LABEL_KEYS: Record<InboxBucket, TranslationKey> = {
  needs_response: 'dashboard.marking.bucket.needs_response',
  in_progress: 'dashboard.marking.bucket.in_progress',
  submitted: 'dashboard.marking.bucket.submitted',
  closed: 'dashboard.marking.bucket.closed',
};

const BUCKET_EMPTY_KEYS: Record<InboxBucket, TranslationKey> = {
  needs_response: 'dashboard.marking.bucketEmpty.needs_response',
  in_progress: 'dashboard.marking.bucketEmpty.in_progress',
  submitted: 'dashboard.marking.bucketEmpty.submitted',
  closed: 'dashboard.marking.bucketEmpty.closed',
};

type Section = 'requests' | 'earnings';

// How often the countdowns re-evaluate. A minute is the finest unit shown.
const CLOCK_TICK_MS = 60_000;

function matchesSearch(request: SpekoohMarkingRequest, query: string): boolean {
  if (!query) return true;
  const haystack = [request.subject, request.report_title, request.exam_type, request.exam_board, request.track, request.exam_year]
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

// The instructor's Spekooh workspace (see supabase/functions/spekooh-webhook,
// spekooh-respond, spekooh-paper-link, spekooh-earnings): an inbox of the
// papers routed to them, a full page per request with the paper and the
// marking work side by side, and their earnings. A top-level tab in
// InstructorDashboard rather than part of S@Learn Classroom -- these are exam
// papers from an external partner platform, not course-teaching work.
export default function SpekoohMarkingRequests() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [requests, setRequests] = useState<SpekoohMarkingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('requests');
  const [bucket, setBucket] = useState<InboxBucket>('needs_response');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setRequests(await fetchMyMarkingRequests(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(() => countByBucket(requests, now), [requests, now]);
  const urgentCount = useMemo(
    () => requests.filter((r) => r.status === 'pending' && !isExpired(r, now) && r.responds_by && timeLeft(r.responds_by, now).urgent).length,
    [requests, now]
  );
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return requests.filter((r) => bucketFor(r, now) === bucket && matchesSearch(r, normalized));
  }, [requests, now, bucket, query]);

  const selected = selectedId === null ? null : (requests.find((r) => r.spekooh_request_id === selectedId) ?? null);

  if (selected) {
    return (
      <SpekoohRequestDetail
        request={selected}
        now={now}
        onBack={() => setSelectedId(null)}
        onChanged={load}
        onViewEarnings={() => {
          setSelectedId(null);
          setSection('earnings');
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex gap-1 mb-6" role="tablist" aria-label={t('dashboard.marking.title')}>
        {(['requests', 'earnings'] as Section[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={section === key}
            onClick={() => setSection(key)}
            className={`h-9 px-4 rounded-[10px] text-sm font-medium transition ${
              section === key ? 'bg-primary-500 text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t(key === 'requests' ? 'dashboard.marking.sectionRequests' : 'dashboard.marking.sectionEarnings')}
          </button>
        ))}
      </div>

      {section === 'earnings' ? (
        <SpekoohEarnings />
      ) : (
        <>
          <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('dashboard.marking.title')}</h1>
          <p className="text-gray-500 mb-6">{t('dashboard.marking.subtitle')}</p>

          {urgentCount > 0 && (
            <div role="status" className="flex items-center gap-2 rounded-[10px] bg-orange-50 text-orange-700 text-sm font-medium px-4 py-3 mb-6">
              <AlertCircle size={16} className="flex-shrink-0" />
              {t('dashboard.marking.urgentBanner')}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12" role="status">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
              <FileText size={40} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-1">{t('dashboard.marking.emptyTitle')}</h3>
              <p className="text-gray-500 text-sm">{t('dashboard.marking.emptyBody')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                <div className="flex gap-1 overflow-x-auto -mx-1 px-1" role="tablist" aria-label={t('dashboard.marking.sectionRequests')}>
                  {INBOX_BUCKETS.map((key) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={bucket === key}
                      onClick={() => setBucket(key)}
                      className={`h-9 px-3 rounded-[10px] text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition ${
                        bucket === key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {t(BUCKET_LABEL_KEYS[key])}
                      <span className={`text-2xs font-semibold px-1.5 rounded-full ${bucket === key ? 'bg-white/20' : 'bg-gray-100'}`}>{counts[key]}</span>
                    </button>
                  ))}
                </div>
                <div className="relative sm:ml-auto sm:w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('dashboard.marking.searchPlaceholder')}
                    aria-label={t('dashboard.marking.searchPlaceholder')}
                    className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="rounded-[14px] border border-canvas-150 p-8 text-center text-sm text-gray-500">
                  {query.trim() ? t('dashboard.marking.noSearchMatch') : t(BUCKET_EMPTY_KEYS[bucket])}
                </p>
              ) : (
                <ul className="space-y-3">
                  {visible.map((request) => {
                    const deadline = activeDeadline(request);
                    return (
                      <li key={request.id}>
                        <button
                          onClick={() => setSelectedId(request.spekooh_request_id)}
                          className="w-full text-left rounded-[14px] border border-canvas-150 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] flex items-center gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">{paperTitle(request) ?? '—'}</h3>
                              <StatusBadge request={request} now={now} t={t} />
                              {deadline && !isExpired(request, now) && <DeadlineChip deadline={deadline} now={now} t={t} />}
                            </div>
                            <FactChips request={request} t={t} />
                          </div>
                          <span className="flex items-center gap-0.5 text-sm font-semibold text-primary-700 flex-shrink-0">
                            <span className="hidden sm:inline">{t('dashboard.marking.open')}</span>
                            <ChevronRight size={16} aria-hidden="true" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
