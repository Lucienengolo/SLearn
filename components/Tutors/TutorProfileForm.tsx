import { useEffect, useState } from 'react';
import { Category, TutorProfileFields } from '../../lib/supabase';
import { fetchAllCategories, fetchMySubjectIds, saveTutorProfile } from '../../lib/tutorProfile';

type TutorProfileFormProps = {
  tutorId: string;
  existingProfile: TutorProfileFields | null;
  onSaved: () => void;
};

const RESPONSE_TIME_OPTIONS = [
  { label: "Moins d'1 heure", value: 60 },
  { label: '1 à 4 heures', value: 240 },
  { label: 'Plus de 4 heures', value: 1440 },
];

// Setup form for tutor_profile_fields/tutor_subjects (0030_tutor_marketplace.sql)
// -- without this, a verified instructor has no way to ever become a
// matching-engine candidate. Reused for both first-time setup and later
// edits (existingProfile is null for the former).
export default function TutorProfileForm({ tutorId, existingProfile, onSaved }: TutorProfileFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [teachingMode, setTeachingMode] = useState<'online' | 'in_person' | 'both'>(existingProfile?.teaching_mode ?? 'both');
  const [neighborhood, setNeighborhood] = useState(existingProfile?.neighborhood ?? '');
  const [languages, setLanguages] = useState<Set<'fr' | 'en'>>(new Set(existingProfile?.languages as ('fr' | 'en')[] ?? ['fr']));
  const [ratePerSession, setRatePerSession] = useState(existingProfile?.rate_per_session?.toString() ?? '');
  const [responseTimeMinutes, setResponseTimeMinutes] = useState<string>(
    existingProfile?.response_time_minutes?.toString() ?? ''
  );
  const [whatsappContact, setWhatsappContact] = useState(existingProfile?.whatsapp_contact ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAllCategories(), fetchMySubjectIds(tutorId)]).then(([cats, subjectIds]) => {
      if (cancelled) return;
      setCategories(cats);
      setSelectedCategoryIds(new Set(subjectIds));
    });
    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLanguage(lang: 'fr' | 'en') {
    setLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      await saveTutorProfile(tutorId, {
        teachingMode,
        neighborhood: neighborhood.trim(),
        languages: Array.from(languages),
        ratePerSession: Number(ratePerSession),
        responseTimeMinutes: responseTimeMinutes ? Number(responseTimeMinutes) : null,
        whatsappContact,
        categoryIds: Array.from(selectedCategoryIds),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de sauvegarder votre profil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-paper border border-ink-border rounded-xl p-6 max-w-[520px] font-general-sans text-ink"
    >
      <h1 className="font-fraunces text-[24px] font-medium mb-1">
        {existingProfile ? 'Modifier votre profil de tuteur' : 'Devenir tuteur'}
      </h1>
      <p className="text-sm text-warm-gray mb-6">Ces informations déterminent avec quels parents vous serez mis en relation.</p>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5">Matières enseignées</label>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCategory(c.id)}
              aria-pressed={selectedCategoryIds.has(c.id)}
              className={`text-[13px] px-3 py-1.5 rounded-full border transition ${
                selectedCategoryIds.has(c.id) ? 'bg-ink text-paper border-ink' : 'border-ink-border hover:border-warm-gray'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5">Mode d&apos;enseignement</label>
        <select
          value={teachingMode}
          onChange={(e) => setTeachingMode(e.target.value as 'online' | 'in_person' | 'both')}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm bg-white focus:outline-none focus:border-ink"
        >
          <option value="both">En ligne et en personne</option>
          <option value="online">En ligne uniquement</option>
          <option value="in_person">En personne uniquement</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-profile-neighborhood">
          Quartier
        </label>
        <input
          id="tutor-profile-neighborhood"
          type="text"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder="ex. Bonamoussadi"
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
        />
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" id="tutor-profile-languages-label">
          Langues
        </label>
        {/* aria-label disambiguates from a same-named subject chip above
            (e.g. a category literally called "Anglais") -- without it,
            "Anglais" the subject and "Anglais" the language are
            indistinguishable to a screen reader, not just to a test query. */}
        <div className="flex gap-1.5" role="group" aria-labelledby="tutor-profile-languages-label">
          {(['fr', 'en'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggleLanguage(lang)}
              aria-pressed={languages.has(lang)}
              aria-label={`Langue : ${lang === 'fr' ? 'Français' : 'Anglais'}`}
              className={`text-[13px] px-3 py-1.5 rounded-full border transition ${
                languages.has(lang) ? 'bg-ink text-paper border-ink' : 'border-ink-border hover:border-warm-gray'
              }`}
            >
              {lang === 'fr' ? 'Français' : 'Anglais'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-profile-rate">
          Tarif par séance (FCFA)
        </label>
        <input
          id="tutor-profile-rate"
          type="number"
          inputMode="numeric"
          min={0}
          value={ratePerSession}
          onChange={(e) => setRatePerSession(e.target.value)}
          placeholder="8000"
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
        />
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-medium mb-1.5">Temps de réponse habituel</label>
        <select
          value={responseTimeMinutes}
          onChange={(e) => setResponseTimeMinutes(e.target.value)}
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm bg-white focus:outline-none focus:border-ink"
        >
          <option value="">Non précisé</option>
          {RESPONSE_TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium mb-1.5" htmlFor="tutor-profile-whatsapp">
          WhatsApp
        </label>
        <input
          id="tutor-profile-whatsapp"
          type="tel"
          value={whatsappContact}
          onChange={(e) => setWhatsappContact(e.target.value)}
          placeholder="+237 6XX XXX XXX"
          className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
        />
      </div>

      {error && <p className="text-[13px] text-oxblood font-medium mb-3">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full min-h-11 bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer mon profil'}
      </button>
    </form>
  );
}
