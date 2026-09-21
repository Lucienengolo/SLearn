import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { SpekoohEarnings as Earnings, SpekoohWithdrawalStatus, fetchEarnings } from '../../lib/spekoohMarkingRequests';
import { formatFCFA } from '../../lib/currency';
import { useLocale } from '../../contexts/LocaleContext';
import StatTile from '../UI/StatTile';
import type { TranslationKey } from '../../lib/i18n';

const WITHDRAWAL_LABEL_KEYS: Record<SpekoohWithdrawalStatus, TranslationKey> = {
  PENDING: 'dashboard.marking.earnings.withdrawal.PENDING',
  APPROVED: 'dashboard.marking.earnings.withdrawal.APPROVED',
  PAID: 'dashboard.marking.earnings.withdrawal.PAID',
};

const WITHDRAWAL_TONES: Record<SpekoohWithdrawalStatus, string> = {
  PENDING: 'bg-primary-50 text-primary-700',
  APPROVED: 'bg-blue-50 text-blue-700',
  PAID: 'bg-green-50 text-green-700',
};

// GUIDE_SUBMITTED: in Spekooh's review queue. PUBLISHED: live for students.
// Anything else says nothing useful to an instructor, so no pill is shown.
function paperStatusKey(status: string | null): TranslationKey | null {
  if (status === 'GUIDE_SUBMITTED' || status === 'MERGED') return 'dashboard.marking.earnings.paperStatus.underReview';
  if (status === 'PUBLISHED') return 'dashboard.marking.earnings.paperStatus.published';
  return null;
}

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; earnings: Earnings };

// Everything shown here is read live from Spekooh, which owns the credit
// ledger and the payouts (see fetchEarnings).
export default function SpekoohEarnings() {
  const { t, locale } = useLocale();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ok', earnings: await fetchEarnings() });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dateFormat = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium' });

  return (
    <div>
      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('dashboard.marking.earnings.title')}</h1>
      <p className="text-gray-500 mb-8">{t('dashboard.marking.earnings.subtitle')}</p>

      {state.kind === 'loading' && (
        <div className="text-center py-12" role="status">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-[14px] border border-canvas-150 p-8 text-center" role="alert">
          <p className="text-gray-700 mb-4">{t('dashboard.marking.earnings.loadError')}</p>
          <button onClick={load} className="h-10 px-5 rounded-[10px] bg-primary-500 text-gray-900 font-medium hover:bg-primary-400 transition">
            {t('dashboard.marking.tryAgain')}
          </button>
        </div>
      )}

      {state.kind === 'ok' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <StatTile icon={Wallet} tone="green" value={formatFCFA(state.earnings.available)} label={t('dashboard.marking.earnings.available')} />
            <StatTile icon={Clock} tone="orange" value={formatFCFA(state.earnings.in_review)} label={t('dashboard.marking.earnings.inReview')} />
            <StatTile icon={CheckCircle2} tone="gold" value={formatFCFA(state.earnings.paid_out)} label={t('dashboard.marking.earnings.paidOut')} />
            <StatTile icon={Banknote} tone="blue" value={formatFCFA(state.earnings.total_earned)} label={t('dashboard.marking.earnings.totalEarned')} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <section aria-labelledby="credits-heading">
              <h2 id="credits-heading" className="text-lg font-semibold text-gray-900 mb-3">
                {t('dashboard.marking.earnings.creditsHeading')}
              </h2>
              {state.earnings.ledger.length === 0 ? (
                <p className="rounded-[14px] border border-canvas-150 p-6 text-sm text-gray-500">{t('dashboard.marking.earnings.creditsEmpty')}</p>
              ) : (
                <ul className="space-y-2">
                  {state.earnings.ledger.map((entry) => {
                    const statusKey = paperStatusKey(entry.paper_status);
                    return (
                      <li key={entry.id} className="rounded-[14px] border border-canvas-150 p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{entry.subject ?? `#${entry.paper_id ?? entry.id}`}</p>
                          <p className="text-2xs text-gray-500">{dateFormat.format(new Date(entry.created_at))}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {statusKey && <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{t(statusKey)}</span>}
                          <span className="font-plex-mono text-sm font-semibold text-gray-900">+{formatFCFA(entry.amount)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="payouts-heading">
              <h2 id="payouts-heading" className="text-lg font-semibold text-gray-900 mb-3">
                {t('dashboard.marking.earnings.payoutsHeading')}
              </h2>
              {state.earnings.withdrawals.length === 0 ? (
                <p className="rounded-[14px] border border-canvas-150 p-6 text-sm text-gray-500">{t('dashboard.marking.earnings.payoutsEmpty')}</p>
              ) : (
                <ul className="space-y-2">
                  {state.earnings.withdrawals.map((withdrawal) => (
                    <li key={withdrawal.id} className="rounded-[14px] border border-canvas-150 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-plex-mono text-sm font-semibold text-gray-900">{formatFCFA(withdrawal.amount)}</span>
                        <span className={`text-2xs font-semibold px-2 py-1 rounded-full ${WITHDRAWAL_TONES[withdrawal.status]}`}>
                          {t(WITHDRAWAL_LABEL_KEYS[withdrawal.status])}
                        </span>
                      </div>
                      <p className="text-2xs text-gray-500 mt-1">
                        {withdrawal.payout_method} · {dateFormat.format(new Date(withdrawal.created_at))} ·{' '}
                        {t('dashboard.marking.earnings.identityCheck')}: {withdrawal.kyc_status.toLowerCase()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-2xs text-gray-500 mt-3">{t('dashboard.marking.earnings.payoutNote')}</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
