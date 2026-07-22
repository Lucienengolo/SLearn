import { useEffect, useState } from 'react';
import { supabase, Category, TutorRequest } from '../../lib/supabase';
import { createTutorRequest, matchTutorRequest, isValidWhatsappContact } from '../../lib/tutorRequests';

type RequestFormProps = {
  onSubmitted: (request: TutorRequest, matched: boolean) => void;
};

type FieldErrors = Partial<{
  categoryId: string;
  grade: string;
  neighborhood: string;
  whatsappContact: string;
  budget: string;
}>;

// Design Review wireframe: ~/.gstack/projects/Lucienengolo-SLearn/designs/
// tutor-mvp-screens-20260721/wireframe.html (Screen 2). Built against
// DESIGN.md's ink-and-paper system, not the app's existing gold/DM-Sans
// pages (see tailwind.config.js's `ink`/`paper`/`oxblood`/`forest` comment).
export default function RequestForm({ onSubmitted }: RequestFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [grade, setGrade] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [whatsappContact, setWhatsappContact] = useState('');
  const [childIdentifier, setChildIdentifier] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!categoryId) next.categoryId = 'Choisissez une matière';
    if (!grade.trim()) next.grade = 'Indiquez le niveau';
    if (!neighborhood.trim()) next.neighborhood = 'Indiquez le quartier';
    if (!whatsappContact.trim()) {
      next.whatsappContact = 'Numéro WhatsApp requis';
    } else if (!isValidWhatsappContact(whatsappContact)) {
      next.whatsappContact = 'Format attendu : +237 6XX XXX XXX';
    }
    const min = budgetMin ? Number(budgetMin) : null;
    const max = budgetMax ? Number(budgetMax) : null;
    if (min !== null && max !== null && min > max) {
      next.budget = 'Le minimum doit être inférieur au maximum';
    }
    return next;
  }

  // Client-side disable is UX only (prevents an accidental extra click while
  // the first request is in flight) -- the real double-submit guard is the
  // server-side idempotency key in create_tutor_request(), which this form
  // never tries to reimplement.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const request = await createTutorRequest({
        categoryId,
        grade: grade.trim(),
        neighborhood: neighborhood.trim(),
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        whatsappContact,
        childIdentifier: childIdentifier.trim() || null,
        // T9 (bilingual UI toggle) isn't built yet -- defaults to French
        // per Design Review D10 until the real toggle state is available.
        preferredLanguage: 'fr',
      });

      const matchResult = await matchTutorRequest(request.id);
      onSubmitted(request, matchResult.matched);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'La demande a échoué. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-paper border border-ink-border rounded-xl p-6 max-w-[520px] font-general-sans text-ink"
    >
      <h1 className="font-fraunces text-[28px] font-medium mb-6">Décrivez ce dont votre enfant a besoin</h1>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-request-subject">
          Matière
        </label>
        <select
          id="tutor-request-subject"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm bg-white focus:outline-none focus:border-ink"
        >
          <option value="">Choisir une matière</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && <p className="text-[12px] text-oxblood font-medium mt-1">{errors.categoryId}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-request-grade">
          Niveau
        </label>
        <input
          id="tutor-request-grade"
          type="text"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="ex. 3ème"
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
        />
        {errors.grade && <p className="text-[12px] text-oxblood font-medium mt-1">{errors.grade}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-request-child">
          Pour quel enfant ? <span className="text-warm-gray font-normal">(optionnel, si vous avez plusieurs enfants)</span>
        </label>
        <input
          id="tutor-request-child"
          type="text"
          value={childIdentifier}
          onChange={(e) => setChildIdentifier(e.target.value)}
          placeholder='ex. "Junior" ou "ma fille cadette"'
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
        />
        <p className="text-[12px] text-warm-gray mt-1">
          Ceci nous aide seulement à organiser vos demandes — pas un profil complet.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-request-neighborhood">
          Quartier
        </label>
        <input
          id="tutor-request-neighborhood"
          type="text"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder="ex. Bonamoussadi"
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
        />
        {errors.neighborhood && <p className="text-[12px] text-oxblood font-medium mt-1">{errors.neighborhood}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5">Budget par séance (FCFA)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            placeholder="5000"
            className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
          />
          <span className="text-warm-gray">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            placeholder="10000"
            className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
          />
        </div>
        {errors.budget && <p className="text-[12px] text-oxblood font-medium mt-1">{errors.budget}</p>}
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-request-whatsapp">
          WhatsApp
        </label>
        <input
          id="tutor-request-whatsapp"
          type="tel"
          value={whatsappContact}
          onChange={(e) => setWhatsappContact(e.target.value)}
          placeholder="+237 6XX XXX XXX"
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
        />
        {errors.whatsappContact && <p className="text-[12px] text-oxblood font-medium mt-1">{errors.whatsappContact}</p>}
      </div>

      {submitError && <p className="text-[13px] text-oxblood font-medium mb-3">{submitError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-11 flex items-center justify-center bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
      >
        {submitting ? 'Recherche en cours…' : 'Trouver un tuteur'}
      </button>
      <p className="text-[12px] text-warm-gray text-center mt-2.5">
        Vous serez notifié dès qu&apos;un tuteur correspond.
      </p>
    </form>
  );
}
