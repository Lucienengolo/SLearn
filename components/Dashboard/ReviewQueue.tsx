import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, FileText, ExternalLink, Users, BookOpen, MessageCircle } from 'lucide-react';
import { InstructorCredential } from '../../lib/supabase';
import {
  ApplicationWithApplicant,
  decideApplication,
  fetchCredentials,
  fetchDecidedApplications,
  fetchMyInterview,
  fetchReviewQueue,
  getCredentialFileUrl,
} from '../../lib/instructorApplications';
import { CourseWithInstructor, decideCourse, fetchDecidedCourses, fetchPendingCourses } from '../../lib/courseModeration';
import { PendingMatchSettlement, fetchPendingSettlements, settleMatch } from '../../lib/tutorBookingSettlement';
import { Interview } from '../../lib/supabase';
import { getCourseCover } from '../../lib/courseCovers';
import { renderRichText } from '../../lib/richText';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

const STATUS_KEYS: Record<string, TranslationKey> = {
  pending: 'dashboard.reviewQueue.statusPending',
  approved: 'dashboard.reviewQueue.statusApproved',
  rejected: 'dashboard.reviewQueue.statusRejected',
};

type Section = 'applications' | 'courses' | 'tutor-bookings';
type Tab = 'pending' | 'decided';

// Reviewer-only: profiles.is_reviewer gates both the "Review queue" nav
// link (Header.tsx) and this page's route (App.tsx) -- but the real
// authorization boundary is server-side (RLS + instructor-approval's own
// is_reviewer check, and courses_guard_moderation for course decisions),
// matching every other privileged action in this app.
export default function ReviewQueue() {
  const { t } = useLocale();
  // Deep-link from a "booking follow-up" notification (App.tsx's
  // handleNavigate sets this hash for admin/matches/* links) -- opens
  // straight to Tutor Bookings instead of defaulting to Applications.
  // Founder report, 2026-08-05.
  const [section, setSection] = useState<Section>(window.location.hash.slice(1) === 'tutor-bookings' ? 'tutor-bookings' : 'applications');
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<ApplicationWithApplicant[]>([]);
  const [decided, setDecided] = useState<ApplicationWithApplicant[]>([]);
  const [pendingCourses, setPendingCourses] = useState<CourseWithInstructor[]>([]);
  const [decidedCourses, setDecidedCourses] = useState<CourseWithInstructor[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<PendingMatchSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [p, d, pc, dc, ps] = await Promise.all([
      fetchReviewQueue(),
      fetchDecidedApplications(),
      fetchPendingCourses(),
      fetchDecidedCourses(),
      fetchPendingSettlements(),
    ]);
    setPending(p);
    setDecided(d);
    setPendingCourses(pc);
    setDecidedCourses(dc);
    setPendingSettlements(ps);
    setLoading(false);
  };

  const isApplications = section === 'applications';
  const isTutorBookings = section === 'tutor-bookings';
  const list = isApplications
    ? tab === 'pending'
      ? pending
      : decided
    : isTutorBookings
    ? pendingSettlements
    : tab === 'pending'
    ? pendingCourses
    : decidedCourses;
  const pendingCount = isApplications ? pending.length : isTutorBookings ? pendingSettlements.length : pendingCourses.length;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="font-display text-3xl sm:text-4xl text-gray-900">{t('nav.reviewQueue')}</h1>
        <span className="text-sm text-gray-500">{pendingCount} {t('dashboard.reviewQueue.awaitingDecision')}</span>
      </div>
      <p className="text-gray-500 mb-6">{t('dashboard.reviewQueue.subtitle')}</p>

      <div className="flex gap-2 mb-4">
        {(['applications', 'courses', 'tutor-bookings'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSection(s);
              setExpandedId(null);
            }}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-medium transition ${
              section === s
                ? 'border-primary-200 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:text-gray-900'
            }`}
          >
            {s === 'applications' ? (
              <>
                <Users size={15} />
                {t('dashboard.reviewQueue.instructorApplications')} ({pending.length})
              </>
            ) : s === 'courses' ? (
              <>
                <BookOpen size={15} />
                {t('nav.courses')} ({pendingCourses.length})
              </>
            ) : (
              <>
                <MessageCircle size={15} />
                {t('dashboard.reviewQueue.tutorBookings')} ({pendingSettlements.length})
              </>
            )}
          </button>
        ))}
      </div>

      {!isTutorBookings && (
        <div className="flex gap-1 mb-6">
          {(['pending', 'decided'] as const).map((tabOption) => (
            <button
              key={tabOption}
              onClick={() => setTab(tabOption)}
              className={`text-sm px-3.5 py-2 rounded-[10px] font-medium transition ${
                tab === tabOption ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tabOption === 'pending' ? `${t('dashboard.reviewQueue.pending')} (${pendingCount})` : t('dashboard.reviewQueue.recentlyDecided')}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <Users size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {isTutorBookings
              ? t('dashboard.reviewQueue.noSettlementsWaiting')
              : tab === 'pending'
              ? isApplications
                ? t('dashboard.reviewQueue.noApplicationsWaiting')
                : t('dashboard.reviewQueue.noCoursesWaiting')
              : t('dashboard.reviewQueue.nothingDecidedYet')}
          </p>
        </div>
      ) : isApplications ? (
        <div className="space-y-3">
          {(list as ApplicationWithApplicant[]).map((app) => (
            <ApplicationCard
              key={app.id}
              application={app}
              expanded={expandedId === app.id}
              onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
              onDecided={load}
            />
          ))}
        </div>
      ) : isTutorBookings ? (
        <div className="space-y-3">
          {(list as PendingMatchSettlement[]).map((settlement) => (
            <MatchSettlementCard key={settlement.match_id} settlement={settlement} onSettled={load} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(list as CourseWithInstructor[]).map((course) => (
            <CourseReviewCard
              key={course.id}
              course={course}
              expanded={expandedId === course.id}
              onToggle={() => setExpandedId(expandedId === course.id ? null : course.id)}
              onDecided={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseReviewCard({
  course,
  expanded,
  onToggle,
  onDecided,
}: {
  course: CourseWithInstructor;
  expanded: boolean;
  onToggle: () => void;
  onDecided: () => void;
}) {
  const { t } = useLocale();
  const [notes, setNotes] = useState(course.moderation_notes ?? '');
  const [deciding, setDeciding] = useState<'approved' | 'rejected' | null>(null);
  const [decideError, setDecideError] = useState('');
  const cover = getCourseCover(course.category?.name);
  const CoverIcon = cover.icon;

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setDeciding(decision);
    setDecideError('');
    try {
      await decideCourse(course.id, decision, notes.trim() || undefined);
      onDecided();
    } catch (err) {
      setDecideError(err instanceof Error ? err.message : t('dashboard.reviewQueue.couldNotRecordDecision'));
    } finally {
      setDeciding(null);
    }
  };

  const statusTint =
    course.moderation_status === 'approved'
      ? 'bg-green-50 text-green-700'
      : course.moderation_status === 'rejected'
      ? 'bg-red-50 text-red-600'
      : 'bg-primary-50 text-primary-700';

  return (
    <div className="rounded-[14px] border border-canvas-150 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50 transition">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-[10px] flex-shrink-0 flex items-center justify-center" style={{ background: cover.gradient }}>
            <CoverIcon size={18} className="text-white/85" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-gray-900 truncate">{course.title}</p>
              <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusTint}`}>
                {t(STATUS_KEYS[course.moderation_status] ?? 'dashboard.reviewQueue.statusPending')}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">
              {t('dashboard.reviewQueue.byPrefix')} {course.instructor?.full_name ?? t('dashboard.reviewQueue.unknown')} · {course.price > 0 ? `$${course.price}` : t('common.free')}
            </p>
          </div>
        </div>
        <span className="text-2xs text-gray-400 flex-shrink-0">{new Date(course.created_at).toLocaleDateString()}</span>
      </button>

      {expanded && (
        <div className="border-t border-canvas-150 p-4 space-y-4">
          <div className="text-sm text-gray-700">{renderRichText(course.description)}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Field label={t('dashboard.reviewQueue.levelFieldLabel')} value={course.level} />
            <Field label={t('dashboard.reviewQueue.durationFieldLabel')} value={`${course.duration_hours}h`} />
            <Field label={t('dashboard.instructor.priceStatLabel')} value={course.price > 0 ? `$${course.price}` : t('common.free')} />
            <Field label={t('dashboard.reviewQueue.instructorEmailFieldLabel')} value={course.instructor?.email} />
          </div>

          {course.moderation_status === 'pending' && (
            <div className="pt-3 border-t border-canvas-150">
              <label htmlFor={`course-notes-${course.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                {t('dashboard.reviewQueue.courseNotesLabel')}
              </label>
              <textarea
                id={`course-notes-${course.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-3"
              />
              {decideError && <p className="text-sm text-red-600 mb-2">{decideError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecision('approved')}
                  disabled={deciding !== null}
                  className="flex items-center gap-1.5 bg-green-600 text-white h-10 px-4 rounded-[10px] hover:bg-green-700 transition font-medium disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  {deciding === 'approved' ? t('dashboard.reviewQueue.approvingEllipsis') : t('dashboard.reviewQueue.approve')}
                </button>
                <button
                  onClick={() => handleDecision('rejected')}
                  disabled={deciding !== null}
                  className="flex items-center gap-1.5 bg-red-50 text-red-600 h-10 px-4 rounded-[10px] hover:bg-red-100 transition font-medium disabled:opacity-50"
                >
                  <XCircle size={16} />
                  {deciding === 'rejected' ? t('dashboard.reviewQueue.rejectingEllipsis') : t('dashboard.reviewQueue.reject')}
                </button>
              </div>
            </div>
          )}

          {course.moderation_notes && course.moderation_status !== 'pending' && (
            <div className="pt-3 border-t border-canvas-150">
              <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">{t('dashboard.reviewQueue.notesLabel')}</p>
              <p className="text-sm text-gray-700">{course.moderation_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchSettlementCard({ settlement, onSettled }: { settlement: PendingMatchSettlement; onSettled: () => void }) {
  const { t } = useLocale();
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState('');

  const handleSettle = async () => {
    setSettling(true);
    setSettleError('');
    try {
      await settleMatch(settlement.match_id);
      onSettled();
    } catch {
      setSettleError(t('dashboard.reviewQueue.couldNotSettle'));
      setSettling(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-canvas-150 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
        <Field label={t('dashboard.reviewQueue.parentFieldLabel')} value={`${settlement.parent_name ?? '—'} · ${settlement.parent_whatsapp}`} />
        <Field label={t('dashboard.reviewQueue.tutorFieldLabel')} value={`${settlement.tutor_name ?? '—'} · ${settlement.tutor_whatsapp}`} />
        <Field label={t('dashboard.reviewQueue.sessionDateFieldLabel')} value={new Date(settlement.confirmed_session_date).toLocaleString()} />
        <Field label={t('dashboard.reviewQueue.rateFieldLabel')} value={`${settlement.rate_per_session}`} />
      </div>
      {settleError && <p className="text-sm text-red-600 mb-2">{settleError}</p>}
      <button
        onClick={handleSettle}
        disabled={settling}
        className="flex items-center gap-1.5 bg-green-600 text-white h-10 px-4 rounded-[10px] hover:bg-green-700 transition font-medium disabled:opacity-50"
      >
        <CheckCircle size={16} />
        {settling ? t('dashboard.reviewQueue.markingSettledEllipsis') : t('dashboard.reviewQueue.markSettled')}
      </button>
    </div>
  );
}

function ApplicationCard({
  application,
  expanded,
  onToggle,
  onDecided,
}: {
  application: ApplicationWithApplicant;
  expanded: boolean;
  onToggle: () => void;
  onDecided: () => void;
}) {
  const { t } = useLocale();
  const [credentials, setCredentials] = useState<InstructorCredential[]>([]);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [deciding, setDeciding] = useState<'approved' | 'rejected' | null>(null);
  const [decideError, setDecideError] = useState('');

  useEffect(() => {
    if (!expanded || credentials.length > 0) return;
    setDetailLoading(true);
    Promise.all([fetchCredentials(application.id), fetchMyInterview(application.id)])
      .then(([c, i]) => {
        setCredentials(c);
        setInterview(i);
      })
      .finally(() => setDetailLoading(false));
  }, [expanded, application.id, credentials.length]);

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setDeciding(decision);
    setDecideError('');
    try {
      await decideApplication(application.id, decision, notes.trim() || undefined);
      onDecided();
    } catch (err) {
      setDecideError(err instanceof Error ? err.message : t('dashboard.reviewQueue.couldNotRecordDecision'));
    } finally {
      setDeciding(null);
    }
  };

  const statusTint =
    application.status === 'approved'
      ? 'bg-green-50 text-green-700'
      : application.status === 'rejected'
      ? 'bg-red-50 text-red-600'
      : 'bg-primary-50 text-primary-700';

  return (
    <div className="rounded-[14px] border border-canvas-150 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50 transition">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-gray-900 truncate">{application.full_name || application.applicant?.full_name || t('dashboard.reviewQueue.unnamedApplicant')}</p>
            <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusTint}`}>
              {t(STATUS_KEYS[application.status] ?? 'dashboard.reviewQueue.statusPending')}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">
            {application.applicant?.email} · {t('dashboard.reviewQueue.proposesPrefix')} "{application.proposed_course_title || t('dashboard.reviewQueue.untitledCourse')}"
          </p>
        </div>
        <span className="text-2xs text-gray-400 flex-shrink-0">
          {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : '—'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-canvas-150 p-4 space-y-4">
          {detailLoading ? (
            <div className="text-center py-6">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Field label={t('dashboard.reviewQueue.headlineFieldLabel')} value={application.headline} />
                <Field label={t('dashboard.reviewQueue.yearsExperienceFieldLabel')} value={application.years_experience?.toString()} />
                <Field label={t('dashboard.reviewQueue.addressFieldLabel')} value={application.address} />
                <Field label={t('dashboard.reviewQueue.areasExpertiseFieldLabel')} value={application.areas_of_expertise?.join(', ')} />
              </div>
              {application.bio && (
                <div>
                  <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">{t('dashboard.reviewQueue.bioLabel')}</p>
                  <div className="text-sm text-gray-700">{renderRichText(application.bio)}</div>
                </div>
              )}
              {application.qualifications && (
                <div>
                  <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">{t('dashboard.reviewQueue.qualificationsLabel')}</p>
                  <p className="text-sm text-gray-700">{application.qualifications}</p>
                </div>
              )}

              <div>
                <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-2">{t('dashboard.reviewQueue.uploadedDocumentsLabel')}</p>
                {credentials.length === 0 ? (
                  <p className="text-sm text-gray-400">{t('dashboard.reviewQueue.noneUploadedYet')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {credentials.map((c) => (
                      <CredentialRow key={c.id} credential={c} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">{t('dashboard.reviewQueue.interviewLabel')}</p>
                <p className="text-sm text-gray-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-gray-400" />
                  {interview
                    ? interview.scheduled_at
                      ? `${t('dashboard.reviewQueue.scheduledPrefix')} ${new Date(interview.scheduled_at).toLocaleString()} — ${t('dashboard.reviewQueue.outcomeWord')}: ${interview.outcome}`
                      : `${t('dashboard.reviewQueue.outcomeLabel')}: ${interview.outcome}`
                    : t('dashboard.reviewQueue.notScheduledYet')}
                </p>
              </div>

              {application.status !== 'approved' && application.status !== 'rejected' && (
                <div className="pt-3 border-t border-canvas-150">
                  <label htmlFor={`notes-${application.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                    {t('dashboard.reviewQueue.decisionNotesLabel')}
                  </label>
                  <textarea
                    id={`notes-${application.id}`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-3"
                  />
                  {decideError && <p className="text-sm text-red-600 mb-2">{decideError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecision('approved')}
                      disabled={deciding !== null}
                      className="flex items-center gap-1.5 bg-green-600 text-white h-10 px-4 rounded-[10px] hover:bg-green-700 transition font-medium disabled:opacity-50"
                    >
                      <CheckCircle size={16} />
                      {deciding === 'approved' ? t('dashboard.reviewQueue.approvingEllipsis') : t('dashboard.reviewQueue.approve')}
                    </button>
                    <button
                      onClick={() => handleDecision('rejected')}
                      disabled={deciding !== null}
                      className="flex items-center gap-1.5 bg-red-50 text-red-600 h-10 px-4 rounded-[10px] hover:bg-red-100 transition font-medium disabled:opacity-50"
                    >
                      <XCircle size={16} />
                      {deciding === 'rejected' ? t('dashboard.reviewQueue.rejectingEllipsis') : t('dashboard.reviewQueue.reject')}
                    </button>
                  </div>
                </div>
              )}

              {application.decision_notes && (
                <div className="pt-3 border-t border-canvas-150">
                  <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">{t('dashboard.reviewQueue.decisionNotesHeaderLabel')}</p>
                  <p className="text-sm text-gray-700">{application.decision_notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-0.5">{label}</p>
      <p className="text-gray-800">{value || '—'}</p>
    </div>
  );
}

function CredentialRow({ credential }: { credential: InstructorCredential }) {
  const { t } = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    const signed = url ?? (await getCredentialFileUrl(credential.storage_path));
    setLoading(false);
    if (signed) {
      setUrl(signed);
      window.open(signed, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex items-center gap-3 border border-canvas-150 rounded-[10px] p-2.5">
      <FileText size={16} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 capitalize truncate">{credential.credential_type.replace('_', ' ')}</p>
        {credential.verification_notes && (
          <p className="text-2xs text-gray-500 truncate">{credential.verification_notes}</p>
        )}
      </div>
      {credential.verification_name_match !== null && (
        <span
          className={`text-2xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            credential.verification_name_match ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {t('dashboard.reviewQueue.namePrefix')} {credential.verification_name_match ? t('dashboard.reviewQueue.nameMatchWord') : t('dashboard.reviewQueue.nameMismatchWord')}
        </span>
      )}
      <button
        onClick={open}
        disabled={loading}
        className="flex items-center gap-1 text-sm text-primary-700 hover:text-primary-800 font-medium flex-shrink-0 disabled:opacity-50"
      >
        <ExternalLink size={14} />
        {loading ? t('common.loadingEllipsis') : t('dashboard.reviewQueue.view')}
      </button>
    </div>
  );
}
