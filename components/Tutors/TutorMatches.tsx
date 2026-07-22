import { useCallback, useEffect, useState } from 'react';
import { fetchMyTutorProfile } from '../../lib/tutorProfile';
import { fetchMyMatchesAsTutor, TutorMatchListItem } from '../../lib/matches';
import { TutorProfileFields } from '../../lib/supabase';
import TutorProfileForm from './TutorProfileForm';

type TutorMatchesProps = {
  tutorId: string;
  onSelectMatch: (matchId: string) => void;
};

const STATUS_LABELS: Record<string, string> = {
  matched: 'En attente de votre réponse',
  messaging: 'En discussion',
  deposit_paid: 'Acompte payé',
  in_progress: 'Séance en cours',
  completed: 'Terminé',
  cancelled_refunded: 'Annulé',
  dispute_review: 'En litige',
  stalled: 'Suivi en cours',
  expired: 'Expiré',
  declined: 'Décliné',
};

// Design Review D1: new tab on the existing instructor dashboard. Also the
// entry point for tutor_profile_fields/tutor_subjects setup (Scope item 1,
// "Tutor profile pages") -- without this, a verified instructor has no way
// to ever become a matching-engine candidate, so the empty state here isn't
// just warmth, it's the only path to the feature actually working at all.
export default function TutorMatches({ tutorId, onSelectMatch }: TutorMatchesProps) {
  const [profile, setProfile] = useState<TutorProfileFields | null>(null);
  const [matches, setMatches] = useState<TutorMatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData, matchesData] = await Promise.all([
        fetchMyTutorProfile(tutorId),
        fetchMyMatchesAsTutor(tutorId),
      ]);
      setProfile(profileData);
      setMatches(matchesData);
    } catch {
      setError('Impossible de charger vos informations de tuteur.');
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-warm-gray">Chargement…</p>;
  if (error) return <p className="text-sm text-oxblood font-medium">{error}</p>;

  if (!profile || editingProfile) {
    return (
      <TutorProfileForm
        tutorId={tutorId}
        existingProfile={profile}
        onSaved={() => {
          setEditingProfile(false);
          load();
        }}
      />
    );
  }

  return (
    <div className="max-w-[700px] font-general-sans text-ink">
      <div className="bg-paper border border-ink-border rounded-xl p-5 mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            {profile.neighborhood} · {profile.rate_per_session.toLocaleString('fr-FR')} FCFA/séance
          </p>
          <p className="text-[12px] text-warm-gray">
            {profile.teaching_mode === 'both' ? 'En ligne et en personne' : profile.teaching_mode === 'online' ? 'En ligne' : 'En personne'}
          </p>
        </div>
        <button
          onClick={() => setEditingProfile(true)}
          className="min-h-9 px-3.5 text-sm font-medium border border-ink-border rounded-lg hover:border-warm-gray transition-colors"
        >
          Modifier
        </button>
      </div>

      <h2 className="font-fraunces text-[20px] font-medium mb-4">Mes mises en relation</h2>

      {matches.length === 0 ? (
        <div className="border border-dashed border-ink-border rounded-lg p-8 text-center">
          <p className="text-sm font-semibold mb-1">Vous apparaîtrez ici dès qu&apos;un parent vous sera mis en relation.</p>
          <p className="text-[13px] text-warm-gray">
            Assurez-vous que votre profil est à jour pour recevoir plus de demandes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectMatch(m.id)}
              className="text-left border border-ink-border rounded-lg p-4 hover:border-warm-gray transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">
                  {m.tutor_requests?.categories?.name ?? 'Matière'} · {m.tutor_requests?.grade}
                </span>
                <span className="text-[12px] font-plex-mono text-warm-gray">{STATUS_LABELS[m.status] ?? m.status}</span>
              </div>
              <p className="text-[13px] text-warm-gray">{m.tutor_requests?.neighborhood}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
