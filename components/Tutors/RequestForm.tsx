import { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { supabase, Category, TutorRequest } from '../../lib/supabase';
import { createTutorRequest, matchTutorRequest, isValidWhatsappContact } from '../../lib/tutorRequests';
import { getCurrentLocation } from '../../lib/geolocation';
import { useLocale } from '../../contexts/LocaleContext';

type RequestFormProps = {
  onSubmitted: (requests: TutorRequest[]) => void;
};

type ChildEntry = {
  key: string;
  identifier: string;
  grade: string;
  categoryIds: string[];
};

function emptyChild(): ChildEntry {
  return { key: crypto.randomUUID(), identifier: '', grade: '', categoryIds: [] };
}

type ChildErrors = Partial<{ grade: string; categoryIds: string }>;

type SharedErrors = Partial<{
  neighborhood: string;
  whatsappContact: string;
  budget: string;
}>;

// Design Review wireframe: ~/.gstack/projects/Lucienengolo-SLearn/designs/
// tutor-mvp-screens-20260721/wireframe.html (Screen 2). Built against
// DESIGN.md's ink-and-paper system, not the app's existing gold/DM-Sans
// pages (see tailwind.config.js's `ink`/`paper`/`oxblood`/`forest` comment).
//
// Founder feedback (2026-07-29): needs to support several children (each
// with their own level) and several subjects per child, plus a precise
// location the matched instructor can navigate to. Locked via
// AskUserQuestion rather than guessed: one TutorRequest row per child PER
// subject (not one row holding an array) -- keeps today's schema and
// matching model unchanged; the form just lets a parent submit several in
// one sitting instead of repeating the whole form.
export default function RequestForm({ onSubmitted }: RequestFormProps) {
  const { t } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [children, setChildren] = useState<ChildEntry[]>([emptyChild()]);
  const [neighborhood, setNeighborhood] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [whatsappContact, setWhatsappContact] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'error'>('idle');
  const [locationError, setLocationError] = useState('');
  const [childErrors, setChildErrors] = useState<Record<string, ChildErrors>>({});
  const [sharedErrors, setSharedErrors] = useState<SharedErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [addingSubjectForChild, setAddingSubjectForChild] = useState<string | null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);

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

  function updateChild(key: string, patch: Partial<ChildEntry>) {
    setChildren((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function toggleSubject(key: string, categoryId: string) {
    setChildren((prev) =>
      prev.map((c) =>
        c.key === key
          ? {
              ...c,
              categoryIds: c.categoryIds.includes(categoryId)
                ? c.categoryIds.filter((id) => id !== categoryId)
                : [...c.categoryIds, categoryId],
            }
          : c
      )
    );
  }

  function addChild() {
    setChildren((prev) => [...prev, emptyChild()]);
  }

  // Founder feedback (2026-07-30): the subject picker had no way to add a
  // subject that isn't already in the fixed list. Mirrors CourseEditor's own
  // "+ New category" inline-creation flow (0028/0041_*.sql widened the
  // categories INSERT policy from verified-instructors-only to any
  // authenticated user for exactly this) -- a new category becomes a real,
  // immediately-matchable subject, not a dead-end free-text field.
  async function handleCreateSubject(childKey: string) {
    const name = newSubjectName.trim();
    if (!name) return;

    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      const child = children.find((c) => c.key === childKey);
      if (child && !child.categoryIds.includes(existing.id)) toggleSubject(childKey, existing.id);
      setAddingSubjectForChild(null);
      setNewSubjectName('');
      return;
    }

    setCreatingSubject(true);
    try {
      const { data, error } = await supabase.from('categories').insert({ name }).select().single();
      if (error) throw error;
      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toggleSubject(childKey, data.id);
      setAddingSubjectForChild(null);
      setNewSubjectName('');
    } finally {
      setCreatingSubject(false);
    }
  }

  function removeChild(key: string) {
    setChildren((prev) => (prev.length > 1 ? prev.filter((c) => c.key !== key) : prev));
  }

  async function handleShareLocation() {
    setLocationStatus('loading');
    setLocationError('');
    try {
      setLocation(await getCurrentLocation());
      setLocationStatus('granted');
    } catch (err) {
      setLocationStatus('error');
      setLocationError(err instanceof Error ? err.message : t('tutorMarketplace.requestForm.errorLocationFailed'));
    }
  }

  function validate(): { children: Record<string, ChildErrors>; shared: SharedErrors } {
    const nextChildErrors: Record<string, ChildErrors> = {};
    for (const child of children) {
      const errs: ChildErrors = {};
      if (!child.grade.trim()) errs.grade = t('tutorMarketplace.requestForm.errorGradeRequired');
      if (child.categoryIds.length === 0) errs.categoryIds = t('tutorMarketplace.requestForm.errorSubjectRequired');
      if (Object.keys(errs).length > 0) nextChildErrors[child.key] = errs;
    }

    const nextSharedErrors: SharedErrors = {};
    if (!neighborhood.trim()) nextSharedErrors.neighborhood = t('tutorMarketplace.requestForm.errorNeighborhoodRequired');
    if (!whatsappContact.trim()) {
      nextSharedErrors.whatsappContact = t('tutorMarketplace.requestForm.errorWhatsappRequired');
    } else if (!isValidWhatsappContact(whatsappContact)) {
      nextSharedErrors.whatsappContact = t('tutorMarketplace.common.whatsappFormatError');
    }
    const min = budgetMin ? Number(budgetMin) : null;
    const max = budgetMax ? Number(budgetMax) : null;
    if (min !== null && max !== null && min > max) {
      nextSharedErrors.budget = t('tutorMarketplace.requestForm.errorBudgetRange');
    }

    return { children: nextChildErrors, shared: nextSharedErrors };
  }

  // Client-side disable is UX only (prevents an accidental extra click while
  // requests are in flight) -- the real double-submit guard is the
  // server-side idempotency key in create_tutor_request(), which this form
  // never tries to reimplement.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const { children: nextChildErrors, shared: nextSharedErrors } = validate();
    setChildErrors(nextChildErrors);
    setSharedErrors(nextSharedErrors);
    if (Object.keys(nextChildErrors).length > 0 || Object.keys(nextSharedErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      // One request per child, per subject that child needs -- e.g. 2
      // children with 2 subjects each creates 4 requests. Collected
      // individually (not Promise.all) so one failure doesn't lose track of
      // requests that already succeeded -- same resilience principle as the
      // match-step fix below.
      const created: TutorRequest[] = [];
      for (const child of children) {
        for (const categoryId of child.categoryIds) {
          created.push(
            await createTutorRequest({
              categoryId,
              grade: child.grade.trim(),
              neighborhood: neighborhood.trim(),
              budgetMin: budgetMin ? Number(budgetMin) : null,
              budgetMax: budgetMax ? Number(budgetMax) : null,
              whatsappContact,
              childIdentifier: child.identifier.trim() || null,
              // T9 (bilingual UI toggle) isn't built yet -- defaults to
              // French per Design Review D10 until the real toggle state is
              // available.
              preferredLanguage: 'fr',
              locationLat: location?.lat ?? null,
              locationLng: location?.lng ?? null,
            })
          );
        }
      }

      // Each request is already saved at this point -- a failure to
      // immediately match (e.g. the matching edge function being briefly
      // unavailable) must not look like the whole submission failed. Same
      // "zero-match/unavailable is not an error state" handling as
      // MatchStatus.tsx's own retry action.
      await Promise.all(
        created.map((request) =>
          matchTutorRequest(request.id).catch(() => {
            // Fall through -- the "still searching" screen's own retry covers this.
          })
        )
      );

      onSubmitted(created);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('tutorMarketplace.requestForm.errorSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-paper border border-ink-border rounded-xl p-4 sm:p-6 max-w-[560px] font-general-sans text-ink"
    >
      <h1 className="font-fraunces text-[28px] font-medium mb-6">{t('tutorMarketplace.requestForm.title')}</h1>

      {children.map((child, index) => (
        <div key={child.key} className="border border-ink-border rounded-lg p-3 sm:p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-warm-gray">
              {t('tutorMarketplace.requestForm.childNumberLabel')} {index + 1}
            </p>
            {children.length > 1 && (
              <button
                type="button"
                onClick={() => removeChild(child.key)}
                className="text-[12px] font-medium text-oxblood hover:text-oxblood-hover"
              >
                {t('tutorMarketplace.requestForm.removeChild')}
              </button>
            )}
          </div>

          <div className="mb-3">
            <label className="block text-[13px] font-medium mb-1.5" htmlFor={`child-identifier-${child.key}`}>
              {t('tutorMarketplace.common.childLabel')} <span className="text-warm-gray font-normal">{t('tutorMarketplace.common.optional')}</span>
            </label>
            <input
              id={`child-identifier-${child.key}`}
              type="text"
              value={child.identifier}
              onChange={(e) => updateChild(child.key, { identifier: e.target.value })}
              placeholder={t('tutorMarketplace.requestForm.childIdentifierPlaceholder')}
              className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div className="mb-3">
            <label className="block text-[13px] font-medium mb-1.5" htmlFor={`child-grade-${child.key}`}>
              {t('tutorMarketplace.common.gradeLabel')}
            </label>
            <input
              id={`child-grade-${child.key}`}
              type="text"
              value={child.grade}
              onChange={(e) => updateChild(child.key, { grade: e.target.value })}
              placeholder={t('tutorMarketplace.requestForm.gradePlaceholder')}
              className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
            />
            {childErrors[child.key]?.grade && (
              <p className="text-[12px] text-oxblood font-medium mt-1">{childErrors[child.key]?.grade}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t('tutorMarketplace.requestForm.subjectsLabel')}</label>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`${t('tutorMarketplace.requestForm.subjectsForChildAria')} ${index + 1}`}>
              {categories.map((category) => {
                const active = child.categoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSubject(child.key, category.id)}
                    className={`px-3 py-1.5 rounded-full border text-[13px] font-medium transition-colors ${
                      active ? 'border-ink bg-ink text-paper' : 'border-ink-border text-ink hover:border-ink'
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setAddingSubjectForChild(child.key);
                  setNewSubjectName('');
                }}
                className="px-3 py-1.5 rounded-full border border-dashed border-ink-border text-[13px] font-medium text-ink hover:border-ink transition-colors flex items-center gap-1"
              >
                <Plus size={13} />
                {t('tutorMarketplace.requestForm.addCustomSubject')}
              </button>
            </div>
            {addingSubjectForChild === child.key && (
              <div className="flex items-center gap-1.5 mt-2">
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateSubject(child.key);
                    }
                  }}
                  placeholder={t('tutorMarketplace.requestForm.newSubjectPlaceholder')}
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-1.5 border border-ink-border rounded-full text-[13px] focus:outline-none focus:border-ink"
                />
                <button
                  type="button"
                  onClick={() => handleCreateSubject(child.key)}
                  disabled={creatingSubject || !newSubjectName.trim()}
                  className="text-[12px] font-medium text-ink underline underline-offset-2 disabled:opacity-50 flex-shrink-0"
                >
                  {creatingSubject ? t('tutorMarketplace.requestForm.addingSubjectEllipsis') : t('tutorMarketplace.requestForm.addSubject')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingSubjectForChild(null);
                    setNewSubjectName('');
                  }}
                  className="text-[12px] text-warm-gray flex-shrink-0"
                >
                  {t('dashboard.courseEditor.cancel')}
                </button>
              </div>
            )}
            {childErrors[child.key]?.categoryIds && (
              <p className="text-[12px] text-oxblood font-medium mt-1">{childErrors[child.key]?.categoryIds}</p>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addChild}
        className="text-[13px] font-medium text-ink underline underline-offset-2 mb-5"
      >
        {t('tutorMarketplace.requestForm.addAnotherChild')}
      </button>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-request-neighborhood">
          {t('tutorMarketplace.profileForm.neighborhoodLabel')}
        </label>
        <input
          id="tutor-request-neighborhood"
          type="text"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder={t('dashboard.instructorApplication.neighborhoodPlaceholder')}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
        />
        {sharedErrors.neighborhood && <p className="text-[12px] text-oxblood font-medium mt-1">{sharedErrors.neighborhood}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5">
          {t('tutorMarketplace.common.locationPreciseLabel')} <span className="text-warm-gray font-normal">{t('tutorMarketplace.common.optional')}</span>
        </label>
        <button
          type="button"
          onClick={handleShareLocation}
          disabled={locationStatus === 'loading'}
          className="flex items-center gap-2 px-3 py-2.5 border border-ink-border rounded-lg text-sm hover:border-ink transition-colors disabled:opacity-60"
        >
          <MapPin size={16} />
          {locationStatus === 'granted'
            ? t('tutorMarketplace.common.locationShared')
            : locationStatus === 'loading'
              ? t('tutorMarketplace.common.locationLoading')
              : t('tutorMarketplace.requestForm.shareLocationCta')}
        </button>
        <p className="text-[12px] text-warm-gray mt-1">
          {t('tutorMarketplace.requestForm.locationHint')}
        </p>
        {locationError && <p className="text-[12px] text-oxblood font-medium mt-1">{locationError}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5">{t('tutorMarketplace.common.budgetLabel')}</label>
        {/* min-w-0 on both inputs: number inputs have a browser-default
            intrinsic minimum width that flexbox respects unless overridden,
            so two w-full inputs side by side would refuse to shrink below
            that and overflow a narrow phone screen instead of splitting the
            row evenly. Found by an actual mobile-width audit. */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            placeholder="5000"
            className="w-full min-w-0 px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
          />
          <span className="text-warm-gray">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            placeholder="10000"
            className="w-full min-w-0 px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
          />
        </div>
        {sharedErrors.budget && <p className="text-[12px] text-oxblood font-medium mt-1">{sharedErrors.budget}</p>}
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-request-whatsapp">
          {t('tutorMarketplace.profileForm.whatsappLabel')}
        </label>
        <input
          id="tutor-request-whatsapp"
          type="tel"
          value={whatsappContact}
          onChange={(e) => setWhatsappContact(e.target.value)}
          placeholder="+237 6XX XXX XXX"
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
        />
        {sharedErrors.whatsappContact && (
          <p className="text-[12px] text-oxblood font-medium mt-1">{sharedErrors.whatsappContact}</p>
        )}
      </div>

      {submitError && <p className="text-[13px] text-oxblood font-medium mb-3">{submitError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-11 flex items-center justify-center bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
      >
        {submitting ? t('tutorMarketplace.common.searchingEllipsis') : t('tutorMarketplace.requestForm.findTutorButton')}
      </button>
      <p className="text-[12px] text-warm-gray text-center mt-2.5">
        {t('tutorMarketplace.requestForm.notifiedHint')}
      </p>
    </form>
  );
}
