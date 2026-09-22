import { useCallback, useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { SpekoohCategory, fetchMyQualifications, fetchSpekoohCategories, saveSpekoohQualifications } from '../../lib/spekoohMarkingRequests';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLocale } from '../../contexts/LocaleContext';

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; categories: SpekoohCategory[] };

// Which of Spekooh's education-level categories (primary/secondary/
// university/...) this instructor is qualified to mark, pushed to Spekooh
// so its own routing can filter on it (see supabase/functions/
// spekooh-qualifications, and that migration's own comment for the
// 2026-09-22 owner report this fixes -- routing previously matched a paper
// to an instructor by subject alone). The category list itself is fetched
// live from Spekooh, never hardcoded here, so the two can't drift apart.
export default function SpekoohQualifications() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setState({ kind: 'loading' });
    try {
      const [categories, mine] = await Promise.all([fetchSpekoohCategories(), fetchMyQualifications(user.id)]);
      setState({ kind: 'ok', categories });
      setSelected(new Set(mine));
    } catch {
      setState({ kind: 'error' });
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveSpekoohQualifications([...selected]);
      showToast(
        t(result.warning ? 'dashboard.marking.qualifications.savedWithWarningToast' : 'dashboard.marking.qualifications.savedToast'),
        result.warning ? 'error' : 'success'
      );
    } catch {
      showToast(t('dashboard.marking.qualifications.saveFailedToast'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('dashboard.marking.qualifications.title')}</h1>
      <p className="text-gray-500 mb-6">{t('dashboard.marking.qualifications.subtitle')}</p>

      {state.kind === 'loading' && (
        <div className="text-center py-12" role="status">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-[14px] border border-canvas-150 p-8 text-center" role="alert">
          <p className="text-gray-700 mb-4">{t('dashboard.marking.qualifications.loadError')}</p>
          <button onClick={load} className="h-10 px-5 rounded-[10px] bg-primary-500 text-gray-900 font-medium hover:bg-primary-400 transition">
            {t('dashboard.marking.tryAgain')}
          </button>
        </div>
      )}

      {state.kind === 'ok' && (
        <>
          {state.categories.length === 0 ? (
            <p className="rounded-[14px] border border-canvas-150 p-8 text-center text-sm text-gray-500">
              {t('dashboard.marking.qualifications.noneAvailable')}
            </p>
          ) : (
            <fieldset className="space-y-2 mb-6">
              <legend className="sr-only">{t('dashboard.marking.qualifications.title')}</legend>
              {state.categories.map((category) => (
                <label
                  key={category.key}
                  className="flex items-center gap-3 rounded-[10px] border border-canvas-150 px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(category.key)}
                    onChange={() => toggle(category.key)}
                    className="w-4 h-4 accent-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{category.title}</span>
                </label>
              ))}
            </fieldset>
          )}

          <button
            onClick={handleSave}
            disabled={saving || state.categories.length === 0}
            className="w-full sm:w-auto bg-primary-500 text-gray-900 h-11 px-6 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
          >
            {t('dashboard.marking.qualifications.saveButton')}
          </button>
          <p className="text-2xs text-gray-500 mt-3 flex items-center gap-1.5">
            <GraduationCap size={13} className="flex-shrink-0" />
            {t('dashboard.marking.qualifications.helpNote')}
          </p>
        </>
      )}
    </div>
  );
}
