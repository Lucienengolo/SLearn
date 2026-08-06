import { useEffect, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
  Users,
  BookOpen,
  MessageCircle,
  ShieldCheck,
  Handshake,
  Megaphone,
  ScrollText,
  UserX,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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
import {
  InstructorListItem,
  InstructorAdminNote,
  fetchAllInstructors,
  deactivateInstructor,
  reactivateInstructor,
  setAdminAccess,
  notifyInstructor,
  fetchInstructorNotes,
  addInstructorNote,
} from '../../lib/instructors';
import { AdminCourseListItem, fetchAllCoursesAdmin, setCoursePublished } from '../../lib/adminCourses';
import { AdminMatchListItem, fetchAllMatchesAdmin, resolveDispute, DisputeResolution } from '../../lib/adminDisputes';
import { formatBudgetRange } from '../../lib/tutorRequests';
import { BroadcastAudience, broadcastAnnouncement } from '../../lib/adminBroadcast';
import { AdminActionLogEntry, fetchAdminActionLog } from '../../lib/adminAuditLog';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

const STATUS_KEYS: Record<string, TranslationKey> = {
  pending: 'dashboard.reviewQueue.statusPending',
  approved: 'dashboard.reviewQueue.statusApproved',
  rejected: 'dashboard.reviewQueue.statusRejected',
};

// Matches the hardcoded principal email in 0054_admin_role.sql's
// set_admin_access() -- this is only a UX gate (which section to show);
// the real authorization check is server-side in the RPC itself.
const PRINCIPAL_ADMIN_EMAIL = 'storefix237@gmail.com';

type Section =
  | 'applications'
  | 'course-moderation'
  | 'pending-settlements'
  | 'instructors'
  | 'published-courses'
  | 'all-matches'
  | 'broadcast'
  | 'activity-log'
  | 'admin-access';
type Tab = 'pending' | 'decided';

const SECTION_LABEL_KEYS: Record<Section, TranslationKey> = {
  applications: 'dashboard.reviewQueue.instructorApplications',
  'course-moderation': 'nav.courses',
  'pending-settlements': 'dashboard.reviewQueue.tutorBookings',
  instructors: 'dashboard.adminPanel.instructorsTab',
  'published-courses': 'dashboard.adminPanel.coursesTab',
  'all-matches': 'dashboard.adminPanel.matchesTab',
  broadcast: 'dashboard.adminPanel.broadcastTab',
  'activity-log': 'dashboard.adminPanel.activityLogTab',
  'admin-access': 'dashboard.adminPanel.adminAccessTab',
};

const SECTION_ICONS: Record<Section, typeof Users> = {
  applications: Users,
  'course-moderation': BookOpen,
  'pending-settlements': MessageCircle,
  instructors: Users,
  'published-courses': BookOpen,
  'all-matches': Handshake,
  broadcast: Megaphone,
  'activity-log': ScrollText,
  'admin-access': ShieldCheck,
};

// Merges the former ReviewQueue.tsx (is_reviewer: applications, course
// moderation, pending tutor-booking settlements) and AdminPanel.tsx
// (is_admin: instructors, published courses, all matches, broadcast,
// activity log, admin access) into one page -- founder feedback,
// 2026-08-06: having them as two separate pages/nav items meant the
// founder's own account (both is_reviewer and is_admin from before this
// session) went looking for new admin features on the page it already
// knew, Review Queue, and found nothing new there. Each section is still
// gated by whichever flag it actually needs; the real authorization
// boundary is always server-side (RLS/RPCs), matching every other
// privileged action in this app.
export default function AdminDashboard() {
  const { t } = useLocale();
  const { profile } = useAuth();
  const isReviewer = !!profile?.is_reviewer;
  const isAdmin = !!profile?.is_admin;
  const isPrincipal = profile?.email === PRINCIPAL_ADMIN_EMAIL;

  const availableSections: Section[] = [
    ...(isReviewer ? (['applications', 'course-moderation', 'pending-settlements'] as const) : []),
    ...(isAdmin ? (['instructors', 'published-courses', 'all-matches', 'broadcast', 'activity-log'] as const) : []),
    ...(isAdmin && isPrincipal ? (['admin-access'] as const) : []),
  ];

  // Deep-link from a "booking follow-up" notification (App.tsx's
  // handleNavigate sets this hash for admin/matches/* links) -- opens
  // straight to Pending Settlements instead of defaulting to Applications.
  const initialHash = window.location.hash.slice(1);
  const initialSection: Section =
    initialHash === 'tutor-bookings' && availableSections.includes('pending-settlements')
      ? 'pending-settlements'
      : availableSections[0] ?? 'applications';

  const [section, setSection] = useState<Section>(initialSection);
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<ApplicationWithApplicant[]>([]);
  const [decided, setDecided] = useState<ApplicationWithApplicant[]>([]);
  const [pendingCourses, setPendingCourses] = useState<CourseWithInstructor[]>([]);
  const [decidedCourses, setDecidedCourses] = useState<CourseWithInstructor[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<PendingMatchSettlement[]>([]);
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const tasks: Promise<unknown>[] = [];
    if (isReviewer) {
      tasks.push(
        fetchReviewQueue().then(setPending),
        fetchDecidedApplications().then(setDecided),
        fetchPendingCourses().then(setPendingCourses),
        fetchDecidedCourses().then(setDecidedCourses),
        fetchPendingSettlements().then(setPendingSettlements)
      );
    }
    if (isAdmin) {
      tasks.push(fetchAllInstructors().then(setInstructors));
    }
    await Promise.all(tasks);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isApplications = section === 'applications';
  const isCourseModeration = section === 'course-moderation';
  const isPendingSettlements = section === 'pending-settlements';
  const list = isApplications
    ? tab === 'pending'
      ? pending
      : decided
    : isPendingSettlements
    ? pendingSettlements
    : tab === 'pending'
    ? pendingCourses
    : decidedCourses;
  const pendingCount = isApplications ? pending.length : isPendingSettlements ? pendingSettlements.length : pendingCourses.length;
  const showsTabs = isApplications || isCourseModeration;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('nav.adminDashboard')}</h1>
      <p className="text-gray-500 mb-6">{t('dashboard.reviewQueue.subtitle')}</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {availableSections.map((s) => {
          const Icon = SECTION_ICONS[s];
          const count =
            s === 'applications'
              ? pending.length
              : s === 'course-moderation'
              ? pendingCourses.length
              : s === 'pending-settlements'
              ? pendingSettlements.length
              : s === 'instructors'
              ? instructors.length
              : null;
          return (
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
              <Icon size={15} />
              {t(SECTION_LABEL_KEYS[s])}
              {count !== null ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {showsTabs && (
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

      {(isApplications || isCourseModeration || isPendingSettlements) &&
        (loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
            <Users size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">
              {isPendingSettlements
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
        ) : isPendingSettlements ? (
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
        ))}

      {section === 'instructors' && (
        <InstructorsSection instructors={instructors} loading={loading} onChanged={load} />
      )}
      {section === 'published-courses' && <PublishedCoursesSection />}
      {section === 'all-matches' && <AllMatchesSection />}
      {section === 'broadcast' && <BroadcastSection />}
      {section === 'activity-log' && <ActivityLogSection />}
      {section === 'admin-access' && isPrincipal && <AdminAccessSection />}
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

function periodLabel(period: 'weekly' | 'monthly' | null, t: (key: TranslationKey) => string): string | null {
  if (period === 'weekly') return t('tutorMarketplace.common.weekly');
  if (period === 'monthly') return t('tutorMarketplace.common.monthly');
  return null;
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
        <Field
          label={t('dashboard.reviewQueue.rateFieldLabel')}
          value={formatBudgetRange(settlement.budget_min, settlement.budget_max, periodLabel(settlement.budget_period, t), t('tutorMarketplace.common.toBeNegotiated'))}
        />
        <Field label={t('dashboard.reviewQueue.frequencyFieldLabel')} value={`${settlement.sessions_per_week}${t('tutorMarketplace.common.perWeekSuffix')}`} />
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

function InstructorsSection({
  instructors,
  loading,
  onChanged,
}: {
  instructors: InstructorListItem[];
  loading: boolean;
  onChanged: () => void;
}) {
  const { t } = useLocale();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  if (instructors.length === 0) {
    return (
      <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
        <Users size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">{t('dashboard.adminPanel.noInstructors')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {instructors.map((i) => (
        <InstructorRow
          key={i.id}
          instructor={i}
          expanded={expandedId === i.id}
          onToggle={() => setExpandedId(expandedId === i.id ? null : i.id)}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function InstructorRow({
  instructor,
  expanded,
  onToggle,
  onChanged,
}: {
  instructor: InstructorListItem;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const { t } = useLocale();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<InstructorAdminNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifySuccess, setNotifySuccess] = useState('');

  useEffect(() => {
    if (!expanded || notes.length > 0) return;
    setNotesLoading(true);
    fetchInstructorNotes(instructor.id)
      .then(setNotes)
      .finally(() => setNotesLoading(false));
  }, [expanded, instructor.id, notes.length]);

  const handleToggleStatus = async () => {
    setBusy(true);
    setError('');
    try {
      if (instructor.verified) {
        await deactivateInstructor(instructor.id);
      } else {
        await reactivateInstructor(instructor.id);
      }
      onChanged();
    } catch {
      setError(t('dashboard.adminPanel.errorToggle'));
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return;
    setBusy(true);
    setError('');
    try {
      await addInstructorNote(instructor.id, user.id, newNote.trim());
      setNewNote('');
      setNotes(await fetchInstructorNotes(instructor.id));
    } catch {
      setError(t('dashboard.adminPanel.errorAddNote'));
    } finally {
      setBusy(false);
    }
  };

  const handleNotify = async () => {
    if (!notifyTitle.trim() || !notifyBody.trim()) return;
    setBusy(true);
    setError('');
    setNotifySuccess('');
    try {
      await notifyInstructor(instructor.id, notifyTitle.trim(), notifyBody.trim());
      setNotifyTitle('');
      setNotifyBody('');
      setNotifySuccess(t('dashboard.adminPanel.notifySuccess'));
    } catch {
      setError(t('dashboard.adminPanel.errorNotify'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-canvas-150 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50 transition">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-gray-900 truncate">{instructor.full_name ?? t('dashboard.reviewQueue.unnamedApplicant')}</p>
            <span
              className={`text-2xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                instructor.verified ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {instructor.verified ? t('dashboard.adminPanel.statusActive') : t('dashboard.adminPanel.statusDeactivated')}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">{instructor.email}</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-canvas-150 p-4 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleToggleStatus}
            disabled={busy}
            className={`flex items-center gap-1.5 h-10 px-4 rounded-[10px] transition font-medium disabled:opacity-50 ${
              instructor.verified ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {instructor.verified ? <UserX size={16} /> : <UserCheck size={16} />}
            {busy ? t('common.loadingEllipsis') : instructor.verified ? t('dashboard.adminPanel.deactivate') : t('dashboard.adminPanel.reactivate')}
          </button>

          <div className="pt-3 border-t border-canvas-150">
            <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-2">{t('dashboard.adminPanel.notifyLabel')}</p>
            <input
              value={notifyTitle}
              onChange={(e) => setNotifyTitle(e.target.value)}
              placeholder={t('dashboard.adminPanel.notifyTitlePlaceholder')}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-2"
            />
            <textarea
              value={notifyBody}
              onChange={(e) => setNotifyBody(e.target.value)}
              rows={2}
              placeholder={t('dashboard.adminPanel.notifyBodyPlaceholder')}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-2"
            />
            {notifySuccess && <p className="text-sm text-green-700 mb-2">{notifySuccess}</p>}
            <button
              onClick={handleNotify}
              disabled={busy || !notifyTitle.trim() || !notifyBody.trim()}
              className="h-9 px-4 rounded-[10px] bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
            >
              {t('dashboard.adminPanel.sendNotification')}
            </button>
          </div>

          <div className="pt-3 border-t border-canvas-150">
            <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-2">{t('dashboard.adminPanel.notesLabel')}</p>
            {notesLoading ? (
              <p className="text-sm text-gray-400">{t('common.loadingEllipsis')}</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-gray-400 mb-2">{t('dashboard.adminPanel.noNotes')}</p>
            ) : (
              <div className="space-y-2 mb-2">
                {notes.map((n) => (
                  <div key={n.id} className="text-sm text-gray-700 bg-gray-50 rounded-[8px] p-2.5">
                    <p>{n.note}</p>
                    <p className="text-2xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              placeholder={t('dashboard.adminPanel.addNotePlaceholder')}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-2"
            />
            <button
              onClick={handleAddNote}
              disabled={busy || !newNote.trim()}
              className="h-9 px-4 rounded-[10px] border border-ink-border text-sm font-medium hover:border-warm-gray transition disabled:opacity-50"
            >
              {t('dashboard.adminPanel.addNote')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PublishedCoursesSection() {
  const { t } = useLocale();
  const [courses, setCourses] = useState<AdminCourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setCourses(await fetchAllCoursesAdmin());
    } catch {
      setError(t('dashboard.adminPanel.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUnpublish = async (courseId: string) => {
    setBusyId(courseId);
    try {
      await setCoursePublished(courseId, false);
      await load();
    } catch {
      setError(t('dashboard.adminPanel.errorToggle'));
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (courses.length === 0) {
    return (
      <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
        <BookOpen size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">{t('dashboard.adminPanel.noCourses')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {courses.map((c) => (
        <div key={c.id} className="rounded-[14px] border border-canvas-150 p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{c.title}</p>
            <p className="text-sm text-gray-500 truncate">{c.instructor_name ?? '—'}</p>
          </div>
          <button
            onClick={() => handleUnpublish(c.id)}
            disabled={busyId === c.id}
            className="flex items-center gap-1.5 h-10 px-4 rounded-[10px] bg-red-50 text-red-600 hover:bg-red-100 transition font-medium disabled:opacity-50 flex-shrink-0"
          >
            {busyId === c.id ? t('common.loadingEllipsis') : t('dashboard.adminPanel.unpublish')}
          </button>
        </div>
      ))}
    </div>
  );
}

function AllMatchesSection() {
  const { t } = useLocale();
  const [matches, setMatches] = useState<AdminMatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setMatches(await fetchAllMatchesAdmin());
    } catch {
      setError(t('dashboard.adminPanel.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolve = async (matchId: string, resolution: DisputeResolution) => {
    setResolvingId(matchId);
    try {
      await resolveDispute(matchId, resolution);
      await load();
    } catch {
      setError(t('dashboard.adminPanel.errorResolve'));
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (matches.length === 0) {
    return (
      <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
        <Handshake size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">{t('dashboard.adminPanel.noMatches')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <div key={m.match_id} className="rounded-[14px] border border-canvas-150 p-4">
          <div className="flex items-center justify-between gap-4 mb-1">
            <p className="font-semibold text-gray-900 truncate">
              {m.parent_name ?? '—'} × {m.tutor_name ?? '—'}
            </p>
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">{m.status}</span>
          </div>
          <p className="text-sm text-gray-500">
            {m.confirmed_session_date ? new Date(m.confirmed_session_date).toLocaleString() : '—'}
            {' · '}{m.sessions_per_week}{t('tutorMarketplace.common.perWeekSuffix')}
            {' · '}{formatBudgetRange(m.budget_min, m.budget_max, periodLabel(m.budget_period, t), t('tutorMarketplace.common.toBeNegotiated'))}
          </p>
          {m.status === 'dispute_review' && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-canvas-150">
              <button
                onClick={() => handleResolve(m.match_id, 'completed')}
                disabled={resolvingId === m.match_id}
                className="h-9 px-3.5 rounded-[10px] bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {t('dashboard.adminPanel.markCompleted')}
              </button>
              <button
                onClick={() => handleResolve(m.match_id, 'cancelled_refunded')}
                disabled={resolvingId === m.match_id}
                className="h-9 px-3.5 rounded-[10px] bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition disabled:opacity-50"
              >
                {t('dashboard.adminPanel.refundParent')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const AUDIENCE_LABEL_KEYS: Record<BroadcastAudience, TranslationKey> = {
  all: 'dashboard.adminPanel.audienceAll',
  students: 'dashboard.adminPanel.audienceStudents',
  instructors: 'dashboard.adminPanel.audienceInstructors',
};

function BroadcastSection() {
  const { t } = useLocale();
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSend = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await broadcastAnnouncement(audience, title.trim(), body.trim());
      setSuccess(t('dashboard.adminPanel.broadcastSuccess'));
      setTitle('');
      setBody('');
    } catch {
      setError(t('dashboard.adminPanel.errorBroadcast'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-canvas-150 p-5 max-w-md">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('dashboard.adminPanel.audienceLabel')}</label>
      <div className="flex gap-2 mb-3">
        {(['all', 'students', 'instructors'] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAudience(a)}
            className={`h-9 px-3.5 rounded-full border text-sm font-medium transition ${
              audience === a ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            {t(AUDIENCE_LABEL_KEYS[a])}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('dashboard.adminPanel.notifyTitlePlaceholder')}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-3"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={t('dashboard.adminPanel.notifyBodyPlaceholder')}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-3"
      />
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {success && <p className="text-sm text-green-700 mb-2">{success}</p>}
      <button
        onClick={handleSend}
        disabled={busy || !title.trim() || !body.trim()}
        className="h-10 px-4 rounded-[10px] bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
      >
        {t('dashboard.adminPanel.sendBroadcast')}
      </button>
    </div>
  );
}

function ActivityLogSection() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<AdminActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminActionLog()
      .then(setEntries)
      .catch(() => setError(t('dashboard.adminPanel.errorLoad')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (entries.length === 0) {
    return (
      <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
        <ScrollText size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">{t('dashboard.adminPanel.noActivity')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.id} className="rounded-[10px] border border-canvas-150 p-3 text-sm flex items-center justify-between gap-3">
          <p className="min-w-0 truncate">
            <span className="font-semibold text-gray-900">{e.admin_name ?? '—'}</span>
            <span className="text-gray-500"> — {e.action}</span>
            {e.detail && <span className="text-gray-400"> ({e.detail})</span>}
          </p>
          <span className="text-2xs text-gray-400 flex-shrink-0">{new Date(e.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function AdminAccessSection() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSet = async (isAdmin: boolean) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await setAdminAccess(email.trim(), isAdmin);
      setSuccess(isAdmin ? t('dashboard.adminPanel.grantedSuccess') : t('dashboard.adminPanel.revokedSuccess'));
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.adminPanel.errorSetAdmin'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-canvas-150 p-5 max-w-md">
      <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1.5">
        {t('dashboard.adminPanel.emailLabel')}
      </label>
      <input
        id="admin-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-3"
      />
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {success && <p className="text-sm text-green-700 mb-2">{success}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => handleSet(true)}
          disabled={busy || !email.trim()}
          className="flex items-center gap-1.5 bg-green-600 text-white h-10 px-4 rounded-[10px] hover:bg-green-700 transition font-medium disabled:opacity-50"
        >
          {t('dashboard.adminPanel.grantAccess')}
        </button>
        <button
          onClick={() => handleSet(false)}
          disabled={busy || !email.trim()}
          className="flex items-center gap-1.5 bg-red-50 text-red-600 h-10 px-4 rounded-[10px] hover:bg-red-100 transition font-medium disabled:opacity-50"
        >
          {t('dashboard.adminPanel.revokeAccess')}
        </button>
      </div>
    </div>
  );
}
