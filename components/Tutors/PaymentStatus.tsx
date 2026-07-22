import { useCallback, useEffect, useState } from 'react';
import { fetchMatchContext, MatchContext } from '../../lib/matches';
import { fetchPaymentForMatch, createDepositCheckout, confirmBalanceReceived, cancelBooking } from '../../lib/tutorPayments';
import { TutorSessionPayment } from '../../lib/supabase';

type PaymentStatusProps = {
  matchId: string;
  viewerRole: 'parent' | 'tutor';
};

const FCFA = new Intl.NumberFormat('fr-FR');

type StepState = 'done' | 'active' | 'upcoming';

function stepStates(matchStatus: string): [StepState, StepState, StepState] {
  if (matchStatus === 'completed') return ['done', 'done', 'done'];
  if (matchStatus === 'deposit_paid' || matchStatus === 'in_progress' || matchStatus === 'stalled' || matchStatus === 'dispute_review') {
    return ['done', 'active', 'upcoming'];
  }
  return ['done', 'upcoming', 'upcoming']; // messaging (no deposit yet): "Unpaid" is the active state
}

// Design Review wireframe Screen 5: ~/.gstack/projects/Lucienengolo-SLearn/
// designs/tutor-mvp-screens-20260721/wireframe.html
export default function PaymentStatus({ matchId, viewerRole }: PaymentStatusProps) {
  const [context, setContext] = useState<MatchContext | null>(null);
  const [payment, setPayment] = useState<TutorSessionPayment | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ctx, pay] = await Promise.all([fetchMatchContext(matchId), fetchPaymentForMatch(matchId)]);
      setContext(ctx);
      setPayment(pay);
    } catch {
      setLoadError('Impossible de charger le statut de votre réservation.');
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePayDeposit() {
    setActionError('');
    setBusy(true);
    try {
      const url = await createDepositCheckout(matchId, window.location.origin);
      window.location.href = url;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Impossible de démarrer le paiement de l'acompte.");
      setBusy(false);
    }
  }

  async function handleConfirmBalance() {
    setActionError('');
    setBusy(true);
    try {
      await confirmBalanceReceived(matchId);
      await load();
    } catch {
      setActionError('Impossible de confirmer la réception du solde. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setActionError('');
    setBusy(true);
    try {
      await cancelBooking(matchId);
      await load();
    } catch {
      setActionError("Impossible d'annuler la réservation. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-sm text-oxblood font-medium">{loadError}</p>;
  if (!context) return <p className="text-sm text-warm-gray">Chargement…</p>;

  const { match, tutorFields } = context;
  const [step1, step2, step3] = stepStates(match.status);
  const depositAmount = payment?.deposit_amount ?? Math.round(tutorFields.rate_per_session * 0.2);
  const balanceAmount = payment?.balance_amount ?? tutorFields.rate_per_session - depositAmount;

  const dotClass = (s: StepState) => (s === 'done' ? 'bg-forest text-white' : s === 'active' ? 'bg-oxblood text-white' : 'bg-warm-gray-light text-white');

  return (
    <div className="bg-paper border border-ink-border rounded-xl p-6 max-w-[640px] font-general-sans text-ink">
      <h1 className="font-fraunces text-[24px] font-medium mb-5">Statut de votre réservation</h1>

      <div className="flex items-center mb-6" role="group" aria-label="Statut du paiement">
        {(['Non payé', 'Acompte payé', 'Réglé'] as const).map((label, i) => {
          const state = [step1, step2, step3][i];
          return (
            <div key={label} className="flex-1 text-center relative">
              {i > 0 && (
                <div
                  className={`absolute top-[14px] right-1/2 w-full h-0.5 -z-10 ${state !== 'upcoming' || [step1, step2, step3][i - 1] === 'done' ? 'bg-forest' : 'bg-warm-gray-light'}`}
                />
              )}
              <div
                role="status"
                aria-label={`Étape ${i + 1} sur 3, ${label}, ${state === 'done' ? 'terminée' : state === 'active' ? 'en cours' : 'à venir'}`}
                className={`w-7 h-7 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-plex-mono font-semibold ${dotClass(state)}`}
              >
                {state === 'done' ? '✓' : i + 1}
              </div>
              <div className="text-xs font-semibold">{label}</div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-sm mb-1.5">
        <span>Acompte (20%)</span>
        <span className="font-plex-mono">
          {FCFA.format(depositAmount)} FCFA — {payment?.deposit_status === 'paid' ? 'payé' : 'en attente'}
        </span>
      </div>
      <div className="flex justify-between text-sm mb-4">
        <span>Solde (à régler sur place)</span>
        <span className="font-plex-mono">
          {FCFA.format(balanceAmount)} FCFA — {payment?.balance_status === 'confirmed' ? 'reçu' : 'en attente'}
        </span>
      </div>

      {match.status === 'messaging' && viewerRole === 'parent' && (
        <button
          onClick={handlePayDeposit}
          disabled={busy}
          className="w-full min-h-11 bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors mb-2"
        >
          {busy ? 'Redirection…' : actionError ? 'Le paiement a échoué — réessayer' : "Payer l'acompte"}
        </button>
      )}
      {match.status === 'messaging' && viewerRole === 'tutor' && (
        <p className="text-sm text-warm-gray mb-4">En attente du paiement de l&apos;acompte par le parent.</p>
      )}

      {match.status === 'deposit_paid' && (
        <div className="bg-[#F2EEE2] border border-ink-border rounded-lg p-3.5 mb-4">
          <p className="text-sm">Le tuteur confirmera la réception du solde après la séance.</p>
        </div>
      )}

      {match.status === 'deposit_paid' && viewerRole === 'parent' && (
        <>
          <button
            onClick={handleCancel}
            disabled={busy}
            className="min-h-11 px-4 border border-ink-border hover:border-warm-gray text-sm font-medium rounded-lg transition-colors"
          >
            Annuler la réservation
          </button>
          <p className="text-[12px] text-warm-gray mt-2">
            Remboursement automatique et complet si annulé plus de 24h avant la séance. Après ce délai, une demande est
            envoyée à notre équipe.
          </p>
        </>
      )}

      {match.status === 'in_progress' && viewerRole === 'tutor' && (
        <button
          onClick={handleConfirmBalance}
          disabled={busy}
          className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
        >
          Confirmer la réception du solde
        </button>
      )}
      {match.status === 'in_progress' && viewerRole === 'parent' && (
        <p className="text-sm text-warm-gray">Vous n&apos;avez rien à faire ici.</p>
      )}

      {match.status === 'completed' && (
        <div className="bg-[#EAF1EE] border border-forest/30 rounded-lg p-3.5">
          <p className="text-sm text-[#14342C] font-medium">Réservation réglée — merci !</p>
        </div>
      )}

      {match.status === 'cancelled_refunded' && (
        <div className="bg-[#EAF1EE] border border-forest/30 rounded-lg p-3.5">
          <p className="text-sm text-[#14342C] font-medium">Remboursement confirmé.</p>
        </div>
      )}

      {match.status === 'dispute_review' && (
        <div className="bg-[#F7E9E6] border border-oxblood/30 rounded-lg p-3.5">
          <p className="text-sm text-[#5E211A] font-medium">
            Votre demande a été transmise à notre équipe pour examen. Réponse sous 24h.
          </p>
        </div>
      )}

      {match.status === 'stalled' && (
        <div className="bg-[#F2EEE2] border border-ink-border rounded-lg p-3.5">
          <p className="text-sm">Nous suivons votre réservation avec le tuteur.</p>
        </div>
      )}

      {actionError && <p className="text-[13px] text-oxblood font-medium mt-3">{actionError}</p>}
    </div>
  );
}
