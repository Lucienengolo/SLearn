import { useCallback, useEffect, useState } from 'react';
import { fetchMyTutorProfile } from '../../lib/tutorProfile';
import { fetchMyMatchesAsTutor, dismissMatch, TERMINAL_MATCH_STATUSES, TutorMatchListItem } from '../../lib/matches';
import { TutorProfileFields } from '../../lib/supabase';
import TutorProfileForm from './TutorProfileForm';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type TutorMatchesProps = {
  tutorId: string;
  onSelectMatch: (matchId: string) => void;
};

const STATUS_KEYS: Record<string, TranslationKey> = {
  matched: 'tutorMarketplace.tutorMatches.statusMatched',
  messaging: 'tutorMarketplace.tutorMatches.statusMessaging',
  deposit_paid: 'tutorMarketplace.tutorMatches.statusDepositPaid',
  in_progress: 'tutorMarketplace.tutorMatches.statusInProgress',
  completed: 'tutorMarketplace.tutorMatches.statusCompleted',
  cancelled_refunded: 'tutorMarketplace.tutorMatches.statusCancelledRefunded',
  dispute_review: 'tutorMarketplace.tutorMatches.statusDisputeReview',
  stalled: 'tutorMarketplace.tutorMatches.statusStalled',
  expired: 'tutorMarketplace.tutorMatches.statusExpired',
  declined: 'tutorMarketplace.tutorMatches.statusDeclined',
};

// Design Review D1: new tab on the existing instructor dashboard. Also the
// entry point for tutor_profile_fields/tutor_subjects setup (Scope item 1,
// "Tutor profile pages") -- without this, a verified instructor has no way
// to ever become a matching-engine candidate, so the empty state here isn't
// just warmth, it's the only path to the feature actually working at all.
export default function TutorMatches({ tutorId, onSelectMatch }: TutorMatchesProps) {
  const { t } = useLocale();
  const [profile, setProfile] = useState<TutorProfileFields | null>(null);
  const [matches, setMatches] = useState<TutorMatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState('');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState('');

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
      setError(t('tutorMarketplace.tutorMatches.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [tutorId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDismiss(matchId: string) {
    setDismissError('');
    setDismissingId(matchId);
    try {
      await dismissMatch(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch {
      setDismissError(t('tutorMarketplace.tutorMatches.errorClear'));
    } finally {
      setDismissingId(null);
    }
  }

  if (loading) return <p className="text-sm text-warm-gray">{t('common.loadingEllipsis')}</p>;
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
            {profile.neighborhood} · {profile.rate_per_session.toLocaleString('fr-FR')} {t('tutorMarketplace.tutorMatches.ratePerSessionSuffix')}
          </p>
          <p className="text-[12px] text-warm-gray">
            {profile.teaching_mode === 'both'
              ? t('dashboard.instructorApplication.onlineInPerson')
              : profile.teaching_mode === 'online'
              ? t('tutorMarketplace.tutorMatches.onlineShort')
              : t('tutorMarketplace.tutorMatches.inPersonShort')}
          </p>
        </div>
        <button
          onClick={() => setEditingProfile(true)}
          className="min-h-9 px-3.5 text-sm font-medium border border-ink-border rounded-lg hover:border-warm-gray transition-colors"
        >
          {t('dashboard.instructor.edit')}
        </button>
      </div>

      <h2 className="font-fraunces text-[20px] font-medium mb-4">{t('tutorMarketplace.tutorMatches.myMatchesHeading')}</h2>

      {matches.length === 0 ? (
        <div className="border border-dashed border-ink-border rounded-lg p-8 text-center">
          <p className="text-sm font-semibold mb-1">{t('tutorMarketplace.tutorMatches.emptyTitle')}</p>
          <p className="text-[13px] text-warm-gray">
            {t('tutorMarketplace.tutorMatches.emptyBody')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dismissError && <p className="text-[13px] text-oxblood font-medium">{dismissError}</p>}
          {matches.map((m) => (
            <div key={m.id} className="flex items-stretch gap-2 border border-ink-border rounded-lg hover:border-warm-gray transition-colors">
              <button onClick={() => onSelectMatch(m.id)} className="flex-1 text-left p-4 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">
                    {m.tutor_requests?.categories?.name ?? t('tutorMarketplace.subjectFallback')} · {m.tutor_requests?.grade}
                  </span>
                  <span className="text-[12px] font-plex-mono text-warm-gray">{t(STATUS_KEYS[m.status] ?? 'tutorMarketplace.tutorMatches.statusMatched')}</span>
                </div>
                <p className="text-[13px] text-warm-gray">
                  {m.tutor_requests?.neighborhood}
                  {m.tutor_requests && ` · ${m.tutor_requests.sessions_per_week}${t('tutorMarketplace.common.perWeekSuffix')}`}
                </p>
              </button>
              {(TERMINAL_MATCH_STATUSES as readonly string[]).includes(m.status) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(m.id);
                  }}
                  disabled={dismissingId === m.id}
                  className="px-3 text-[12px] font-medium text-warm-gray hover:text-oxblood transition-colors flex-shrink-0"
                >
                  {t('tutorMarketplace.tutorMatches.clear')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
