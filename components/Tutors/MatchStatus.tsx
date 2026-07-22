import { useCallback, useEffect, useState } from 'react';
import { fetchRequestMatchState, RequestMatchState } from '../../lib/matches';
import { matchTutorRequest } from '../../lib/tutorRequests';
import Chat from './Chat';
import PaymentStatus from './PaymentStatus';

type MatchStatusProps = {
  requestId: string;
  currentUserId: string;
};

// Design Review Pass 3/E7: "still looking" is a first-class screen, not a
// bare fallback -- it's plausibly the MODAL outcome at cold-start with only
// a handful of beta tutors. Wireframe: ~/.gstack/projects/
// Lucienengolo-SLearn/designs/tutor-mvp-screens-20260721/wireframe.html
// (Screen 3), including the D5 "previous match didn't work out" variant.
export default function MatchStatus({ requestId, currentUserId }: MatchStatusProps) {
  const [state, setState] = useState<RequestMatchState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await fetchRequestMatchState(requestId));
      setLoadError('');
    } catch {
      setLoadError('Impossible de charger le statut de votre demande.');
    }
  }, [requestId]);

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

  if (loadError) {
    return <p className="text-sm text-oxblood font-medium">{loadError}</p>;
  }
  if (!state) {
    return <p className="text-sm text-warm-gray">Chargement…</p>;
  }

  if (state.activeMatch) {
    return (
      <div className="flex flex-col gap-5">
        <Chat matchId={state.activeMatch.id} currentUserId={currentUserId} viewerRole="parent" />
        <PaymentStatus matchId={state.activeMatch.id} viewerRole="parent" />
      </div>
    );
  }

  return (
    <div className="bg-paper border border-ink-border rounded-xl p-6 max-w-[600px] font-general-sans text-ink">
      <h1 className="font-fraunces text-[24px] font-medium mb-4">On cherche toujours votre tuteur</h1>

      <div className="bg-[#EAF1EE] border border-forest/30 rounded-lg p-3.5 mb-4 flex gap-2.5 items-start">
        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-forest" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <p className="text-[13px] text-[#14342C]">
          Votre demande est bien reçue. Notre équipe a été alertée et cherche activement un tuteur en {state.request.grade}
          {' '}à {state.request.neighborhood}.
        </p>
      </div>

      {state.hadPriorMatch && (
        <div className="bg-[#F2EEE2] border border-ink-border rounded-lg p-3.5 mb-4">
          <p className="text-sm">Votre précédent match n&apos;a pas abouti — nous cherchons un autre tuteur pour vous.</p>
        </div>
      )}

      <p className="text-sm mb-4">
        Aucun tuteur disponible pour l&apos;instant — c&apos;est fréquent au lancement, le nombre de tuteurs vérifiés
        grandit chaque semaine.
      </p>

      <button
        onClick={handleRetry}
        disabled={retrying}
        className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
      >
        {retrying ? 'Recherche en cours…' : 'Réessayer la recherche'}
      </button>
    </div>
  );
}
