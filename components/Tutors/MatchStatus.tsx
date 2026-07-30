import { useCallback, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { fetchRequestMatchState, RequestMatchState } from '../../lib/matches';
import { matchTutorRequest, updateTutorRequest, cancelTutorRequest, isValidWhatsappContact } from '../../lib/tutorRequests';
import { getCurrentLocation } from '../../lib/geolocation';
import { supabase, Category } from '../../lib/supabase';
import ConfirmDialog from '../UI/ConfirmDialog';
import Chat from './Chat';
import PaymentStatus from './PaymentStatus';
import { useLocale } from '../../contexts/LocaleContext';

type MatchStatusProps = {
  requestId: string;
  currentUserId: string;
  onCancelled: () => void;
};

// Design Review Pass 3/E7: "still looking" is a first-class screen, not a
// bare fallback -- it's plausibly the MODAL outcome at cold-start with only
// a handful of beta tutors. Wireframe: ~/.gstack/projects/
// Lucienengolo-SLearn/designs/tutor-mvp-screens-20260721/wireframe.html
// (Screen 3), including the D5 "previous match didn't work out" variant.
export default function MatchStatus({ requestId, currentUserId, onCancelled }: MatchStatusProps) {
  const { t } = useLocale();
  const [state, setState] = useState<RequestMatchState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await fetchRequestMatchState(requestId));
      setLoadError('');
    } catch {
      setLoadError(t('tutorMarketplace.matchStatus.errorLoad'));
    }
  }, [requestId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await matchTutorRequest(requestId);
    } catch {
      // Zero-match is not an error state (see handleZeroMatch in the
      // match-tutor-request edge function) -- reload regardless of outcome.
    } finally {
      setRetrying(false);
      load();
    }
  }

  async function handleConfirmCancel() {
    setCancelling(true);
    try {
      await cancelTutorRequest(requestId);
      onCancelled();
    } finally {
      setCancelling(false);
      setCancelDialogOpen(false);
    }
  }

  if (loadError) {
    return <p className="text-sm text-oxblood font-medium">{loadError}</p>;
  }
  if (!state) {
    return <p className="text-sm text-warm-gray">{t('common.loadingEllipsis')}</p>;
  }

  if (state.activeMatch) {
    return (
      <div className="flex flex-col gap-5">
        <Chat matchId={state.activeMatch.id} currentUserId={currentUserId} viewerRole="parent" />
        <PaymentStatus matchId={state.activeMatch.id} viewerRole="parent" />
      </div>
    );
  }

  if (editing) {
    return (
      <EditRequestPanel
        request={state.request}
        onSaved={() => {
          setEditing(false);
          load();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="bg-paper border border-ink-border rounded-xl p-6 max-w-[600px] font-general-sans text-ink">
      <h1 className="font-fraunces text-[24px] font-medium mb-4">{t('tutorMarketplace.matchStatus.stillSearchingTitle')}</h1>

      <div className="bg-[#EAF1EE] border border-forest/30 rounded-lg p-3.5 mb-4 flex gap-2.5 items-start">
        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-forest" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <p className="text-[13px] text-[#14342C]">
          {t('tutorMarketplace.matchStatus.receivedPrefix')} {state.request.grade}
          {' '}{t('tutorMarketplace.matchStatus.receivedSuffix')} {state.request.neighborhood}.
        </p>
      </div>

      {state.hadPriorMatch && (
        <div className="bg-[#F2EEE2] border border-ink-border rounded-lg p-3.5 mb-4">
          <p className="text-sm">{t('tutorMarketplace.matchStatus.priorMatchNote')}</p>
        </div>
      )}

      <p className="text-sm mb-4">
        {t('tutorMarketplace.matchStatus.noTutorAvailableNote')}
      </p>

      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
        >
          {retrying ? t('tutorMarketplace.common.searchingEllipsis') : t('tutorMarketplace.matchStatus.retrySearch')}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="min-h-11 px-4 border border-ink-border hover:border-ink text-sm font-medium rounded-lg transition-colors"
        >
          {t('tutorMarketplace.matchStatus.editRequest')}
        </button>
        <button
          onClick={() => setCancelDialogOpen(true)}
          className="min-h-11 px-4 text-oxblood hover:bg-oxblood/5 text-sm font-medium rounded-lg transition-colors"
        >
          {t('tutorMarketplace.matchStatus.deleteRequest')}
        </button>
      </div>

      <ConfirmDialog
        isOpen={cancelDialogOpen}
        title={t('tutorMarketplace.matchStatus.deleteConfirmTitle')}
        message={t('tutorMarketplace.matchStatus.deleteConfirmMessage')}
        confirmLabel={cancelling ? t('tutorMarketplace.matchStatus.deletingEllipsis') : t('tutorMarketplace.matchStatus.deleteRequest')}
        destructive
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelDialogOpen(false)}
      />
    </div>
  );
}

type EditRequestPanelProps = {
  request: RequestMatchState['request'];
  onSaved: () => void;
  onCancel: () => void;
};

// Only reachable while the request is still 'searching' (the "still
// looking" screen above is itself gated on !state.activeMatch) -- matches
// the "editable only while searching" scope locked in via AskUserQuestion,
// same boundary the 0040_tutor_request_location_edit.sql RLS policy
// enforces server-side.
function EditRequestPanel({ request, onSaved, onCancel }: EditRequestPanelProps) {
  const { t } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(request.category_id);
  const [grade, setGrade] = useState(request.grade);
  const [neighborhood, setNeighborhood] = useState(request.neighborhood);
  const [budgetMin, setBudgetMin] = useState(request.budget_min?.toString() ?? '');
  const [budgetMax, setBudgetMax] = useState(request.budget_max?.toString() ?? '');
  const [whatsappContact, setWhatsappContact] = useState(request.whatsapp_contact);
  const [childIdentifier, setChildIdentifier] = useState(request.child_identifier ?? '');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    request.location_lat != null && request.location_lng != null
      ? { lat: request.location_lat, lng: request.location_lng }
      : null
  );
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'error'>(
    location ? 'granted' : 'idle'
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setCategories(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleShareLocation() {
    setLocationStatus('loading');
    try {
      setLocation(await getCurrentLocation());
      setLocationStatus('granted');
    } catch {
      setLocationStatus('error');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!isValidWhatsappContact(whatsappContact)) {
      setError(t('tutorMarketplace.common.whatsappFormatError'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateTutorRequest(request.id, {
        categoryId,
        grade: grade.trim(),
        neighborhood: neighborhood.trim(),
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        whatsappContact,
        childIdentifier: childIdentifier.trim() || null,
        locationLat: location?.lat ?? null,
        locationLng: location?.lng ?? null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tutorMarketplace.matchStatus.errorEditFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-paper border border-ink-border rounded-xl p-6 max-w-[560px] font-general-sans text-ink"
    >
      <h1 className="font-fraunces text-[24px] font-medium mb-5">{t('tutorMarketplace.matchStatus.editRequest')}</h1>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="edit-request-subject">
          {t('tutorMarketplace.matchStatus.subjectLabel')}
        </label>
        <select
          id="edit-request-subject"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm bg-white focus:outline-none focus:border-ink"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="edit-request-grade">
          {t('tutorMarketplace.common.gradeLabel')}
        </label>
        <input
          id="edit-request-grade"
          type="text"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
        />
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="edit-request-child">
          {t('tutorMarketplace.common.childLabel')} <span className="text-warm-gray font-normal">{t('tutorMarketplace.common.optional')}</span>
        </label>
        <input
          id="edit-request-child"
          type="text"
          value={childIdentifier}
          onChange={(e) => setChildIdentifier(e.target.value)}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
        />
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="edit-request-neighborhood">
          {t('tutorMarketplace.profileForm.neighborhoodLabel')}
        </label>
        <input
          id="edit-request-neighborhood"
          type="text"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
        />
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5">{t('tutorMarketplace.common.locationPreciseLabel')}</label>
        <button
          type="button"
          onClick={handleShareLocation}
          disabled={locationStatus === 'loading'}
          className="flex items-center gap-2 px-3 py-2.5 border border-ink-border rounded-lg text-sm hover:border-ink transition-colors disabled:opacity-60"
        >
          <MapPin size={16} />
          {locationStatus === 'granted' ? t('tutorMarketplace.common.locationShared') : locationStatus === 'loading' ? t('tutorMarketplace.common.locationLoading') : t('tutorMarketplace.matchStatus.shareLocationShort')}
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5">{t('tutorMarketplace.common.budgetLabel')}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            className="w-full min-w-0 px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
          />
          <span className="text-warm-gray">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            className="w-full min-w-0 px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="edit-request-whatsapp">
          {t('tutorMarketplace.profileForm.whatsappLabel')}
        </label>
        <input
          id="edit-request-whatsapp"
          type="tel"
          value={whatsappContact}
          onChange={(e) => setWhatsappContact(e.target.value)}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
        />
      </div>

      {error && <p className="text-[13px] text-oxblood font-medium mb-3">{error}</p>}

      <div className="flex gap-2.5">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 px-4 flex-1 flex items-center justify-center bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
        >
          {saving ? t('tutorMarketplace.profileForm.savingEllipsis') : t('tutorMarketplace.common.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 px-4 border border-ink-border hover:border-ink text-sm font-medium rounded-lg transition-colors"
        >
          {t('dashboard.courseEditor.cancel')}
        </button>
      </div>
    </form>
  );
}
