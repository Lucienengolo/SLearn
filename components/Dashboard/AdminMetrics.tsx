import { useEffect, useState } from 'react';
import { fetchTutorRequestMatchStats, TutorRequestMatchStat } from '../../lib/adminMetrics';
import { supabase, Category } from '../../lib/supabase';
import { useLocale } from '../../contexts/LocaleContext';

// Reviewer-only, same pattern as ReviewQueue.tsx: gated by the nav link and
// route (profile.is_reviewer), with the real authorization boundary
// server-side (tutor_request_match_stats' own reviewer check, 0033).
export default function AdminMetrics() {
  const { t } = useLocale();
  const [stats, setStats] = useState<TutorRequestMatchStat[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [statRows, { data: categoryRows }] = await Promise.all([
        fetchTutorRequestMatchStats(),
        supabase.from('categories').select('*'),
      ]);
      setStats(statRows);
      setCategories(Object.fromEntries(((categoryRows ?? []) as Category[]).map((c) => [c.id, c.name])));
    } catch {
      setError(t('dashboard.admin.errorLoad'));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="text-sm text-warm-gray">{t('common.loadingEllipsis')}</p>;
  if (error) return <p className="text-sm text-oxblood font-medium">{error}</p>;

  return (
    <div className="bg-paper border border-ink-border rounded-xl p-6 max-w-[800px] font-general-sans text-ink">
      <h1 className="font-fraunces text-[24px] font-medium mb-1">{t('dashboard.admin.title')}</h1>
      <p className="text-sm text-warm-gray mb-5">{t('dashboard.admin.subtitle')}</p>

      {stats.length === 0 ? (
        <div className="border border-dashed border-ink-border rounded-lg p-6 text-center">
          <p className="text-sm text-warm-gray">{t('dashboard.admin.emptyState')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-border text-left text-[12px] text-warm-gray uppercase font-plex-mono">
                <th className="pb-2 pr-4">{t('dashboard.admin.colSubject')}</th>
                <th className="pb-2 pr-4">{t('dashboard.admin.colNeighborhood')}</th>
                <th className="pb-2 pr-4 text-right">{t('dashboard.admin.colTotal')}</th>
                <th className="pb-2 pr-4 text-right">{t('dashboard.admin.colUnmatched')}</th>
                <th className="pb-2 pr-4 text-right">{t('dashboard.admin.colMatched')}</th>
                <th className="pb-2 text-right">{t('dashboard.admin.colUnmatchedRate')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={`${row.category_id}-${row.neighborhood}`} className="border-b border-ink-border last:border-0">
                  <td className="py-2.5 pr-4">{categories[row.category_id] ?? row.category_id}</td>
                  <td className="py-2.5 pr-4">{row.neighborhood}</td>
                  <td className="py-2.5 pr-4 text-right font-plex-mono">{row.total_requests}</td>
                  <td className="py-2.5 pr-4 text-right font-plex-mono">{row.unmatched_count}</td>
                  <td className="py-2.5 pr-4 text-right font-plex-mono">{row.matched_count}</td>
                  <td className="py-2.5 text-right font-plex-mono font-semibold">
                    <span className={row.unmatched_rate_pct >= 50 ? 'text-oxblood' : 'text-ink'}>
                      {row.unmatched_rate_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
