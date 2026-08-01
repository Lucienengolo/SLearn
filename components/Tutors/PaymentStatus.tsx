import { useCallback, useEffect, useState } from 'react';
import { fetchMatchContext, MatchContext } from '../../lib/matches';
import { fetchPaymentForMatch, createDepositCheckout, confirmBalanceReceived, cancelBooking } from '../../lib/tutorPayments';
import { TutorSessionPayment } from '../../lib/supabase';
import { useLocale } from '../../contexts/LocaleContext';
import { PAYMENTS_ENABLED } from '../../lib/paymentsConfig';

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
  const { t } = useLocale();
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
      setLoadError(t('tutorMarketplace.paymentStatus.errorLoad'));
    }
  }, [matchId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePayDeposit() {
    setActionError('');
    if (!PAYMENTS_ENABLED) {
      setActionError(t('tutorMarketplace.paymentStatus.paymentsComingSoon'));
      return;
    }
    setBusy(true);
    try {
      const url = await createDepositCheckout(matchId, window.location.origin);
      window.location.href = url;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('tutorMarketplace.paymentStatus.errorStartDeposit'));
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
      setActionError(t('tutorMarketplace.paymentStatus.errorConfirmBalance'));
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
      setActionError(t('tutorMarketplace.paymentStatus.errorCancel'));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-sm text-oxblood font-medium">{loadError}</p>;
  if (!context) return <p className="text-sm text-warm-gray">{t('common.loadingEllipsis')}</p>;

  const { match, tutorFields } = context;
  const [step1, step2, step3] = stepStates(match.status);
  const depositAmount = payment?.deposit_amount ?? Math.round(tutorFields.rate_per_session * 0.2);
  const balanceAmount = payment?.balance_amount ?? tutorFields.rate_per_session - depositAmount;

  const dotClass = (s: StepState) => (s === 'done' ? 'bg-forest text-white' : s === 'active' ? 'bg-oxblood text-white' : 'bg-warm-gray-light text-white');

  return (
    <div className="bg-paper border border-ink-border rounded-xl p-4 sm:p-6 max-w-[640px] font-general-sans text-ink">
      <h1 className="font-fraunces text-[24px] font-medium mb-5">{t('tutorMarketplace.paymentStatus.title')}</h1>

      <div className="flex items-center mb-6" role="group" aria-label={t('tutorMarketplace.paymentStatus.paymentStatusAriaLabel')}>
        {([
          t('tutorMarketplace.paymentStatus.stepUnpaid'),
          t('tutorMarketplace.tutorMatches.statusDepositPaid'),
          t('tutorMarketplace.paymentStatus.stepSettled'),
        ] as const).map((label, i) => {
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
                aria-label={`${t('tutorMarketplace.paymentStatus.stepPrefix')} ${i + 1} ${t('tutorMarketplace.paymentStatus.ofThree')}, ${label}, ${state === 'done' ? t('tutorMarketplace.paymentStatus.stateDone') : state === 'active' ? t('tutorMarketplace.paymentStatus.stateActive') : t('tutorMarketplace.paymentStatus.stateUpcoming')}`}
                className={`w-7 h-7 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-plex-mono font-semibold ${dotClass(state)}`}
              >
                {state === 'done' ? '✓' : i + 1}
              </div>
              <div className="text-xs font-semibold">{label}</div>
            </div>
          );
        })}
      </div>

      {/* flex-col on mobile, not flex-row justify-between: a long label
          ("Solde (à régler sur place)") next to a long value ("4 000 FCFA —
          en attente") don't both fit on one line at phone widths, and
          forcing them side by side made each wrap mid-phrase instead
          ("en" / "attente" splitting apart). Stacking gives each its own
          full-width line; sm:flex-row restores the side-by-side layout
          once there's room. */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 text-sm mb-1.5">
        <span>{t('tutorMarketplace.paymentStatus.depositLabel')}</span>
        <span className="font-plex-mono">
          {FCFA.format(depositAmount)} FCFA — {payment?.deposit_status === 'paid' ? t('tutorMarketplace.paymentStatus.paidWord') : t('tutorMarketplace.paymentStatus.pendingWord')}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 text-sm mb-4">
        <span>{t('tutorMarketplace.paymentStatus.balanceLabel')}</span>
        <span className="font-plex-mono">
          {FCFA.format(balanceAmount)} FCFA — {payment?.balance_status === 'confirmed' ? t('tutorMarketplace.paymentStatus.receivedWord') : t('tutorMarketplace.paymentStatus.pendingWord')}
        </span>
      </div>

      {match.status === 'messaging' && viewerRole === 'parent' && (
        <button
          onClick={handlePayDeposit}
          disabled={busy}
          className="w-full min-h-11 bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors mb-2"
        >
          {busy ? t('tutorMarketplace.paymentStatus.redirectingEllipsis') : actionError ? t('tutorMarketplace.paymentStatus.paymentFailedRetry') : t('tutorMarketplace.paymentStatus.payDeposit')}
        </button>
      )}
      {match.status === 'messaging' && viewerRole === 'tutor' && (
        <p className="text-sm text-warm-gray mb-4">{t('tutorMarketplace.paymentStatus.waitingDepositTutorNote')}</p>
      )}

      {match.status === 'deposit_paid' && (
        <div className="bg-[#F2EEE2] border border-ink-border rounded-lg p-3.5 mb-4">
          <p className="text-sm">{t('tutorMarketplace.paymentStatus.tutorWillConfirmNote')}</p>
        </div>
      )}

      {match.status === 'deposit_paid' && viewerRole === 'parent' && (
        <>
          <button
            onClick={handleCancel}
            disabled={busy}
            className="min-h-11 px-4 border border-ink-border hover:border-warm-gray text-sm font-medium rounded-lg transition-colors"
          >
            {t('tutorMarketplace.paymentStatus.cancelBooking')}
          </button>
          <p className="text-[12px] text-warm-gray mt-2">
            {t('tutorMarketplace.paymentStatus.refundPolicyNote')}
          </p>
        </>
      )}

      {match.status === 'in_progress' && viewerRole === 'tutor' && (
        <button
          onClick={handleConfirmBalance}
          disabled={busy}
          className="min-h-11 px-4 bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
        >
          {t('tutorMarketplace.paymentStatus.confirmBalanceReceipt')}
        </button>
      )}
      {match.status === 'in_progress' && viewerRole === 'parent' && (
        <p className="text-sm text-warm-gray">{t('tutorMarketplace.paymentStatus.nothingToDoParentNote')}</p>
      )}

      {match.status === 'completed' && (
        <div className="bg-[#EAF1EE] border border-forest/30 rounded-lg p-3.5">
          <p className="text-sm text-[#14342C] font-medium">{t('tutorMarketplace.paymentStatus.settledThanks')}</p>
        </div>
      )}

      {match.status === 'cancelled_refunded' && (
        <div className="bg-[#EAF1EE] border border-forest/30 rounded-lg p-3.5">
          <p className="text-sm text-[#14342C] font-medium">{t('tutorMarketplace.paymentStatus.refundConfirmed')}</p>
        </div>
      )}

      {match.status === 'dispute_review' && (
        <div className="bg-[#F7E9E6] border border-oxblood/30 rounded-lg p-3.5">
          <p className="text-sm text-[#5E211A] font-medium">
            {t('tutorMarketplace.paymentStatus.disputeNote')}
          </p>
        </div>
      )}

      {match.status === 'stalled' && (
        <div className="bg-[#F2EEE2] border border-ink-border rounded-lg p-3.5">
          <p className="text-sm">{t('tutorMarketplace.paymentStatus.stalledNote')}</p>
        </div>
      )}

      {actionError && <p className="text-[13px] text-oxblood font-medium mt-3">{actionError}</p>}
    </div>
  );
}
