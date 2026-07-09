import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, FileText, ExternalLink, Users, BookOpen } from 'lucide-react';
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
import { Interview } from '../../lib/supabase';
import { getCourseCover } from '../../lib/courseCovers';

type Section = 'applications' | 'courses';
type Tab = 'pending' | 'decided';

// Reviewer-only: profiles.is_reviewer gates both the "Review queue" nav
// link (Header.tsx) and this page's route (App.tsx) -- but the real
// authorization boundary is server-side (RLS + instructor-approval's own
// is_reviewer check, and courses_guard_moderation for course decisions),
// matching every other privileged action in this app.
export default function ReviewQueue() {
  const [section, setSection] = useState<Section>('applications');
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<ApplicationWithApplicant[]>([]);
  const [decided, setDecided] = useState<ApplicationWithApplicant[]>([]);
  const [pendingCourses, setPendingCourses] = useState<CourseWithInstructor[]>([]);
  const [decidedCourses, setDecidedCourses] = useState<CourseWithInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [p, d, pc, dc] = await Promise.all([
      fetchReviewQueue(),
      fetchDecidedApplications(),
      fetchPendingCourses(),
      fetchDecidedCourses(),
    ]);
    setPending(p);
    setDecided(d);
    setPendingCourses(pc);
    setDecidedCourses(dc);
    setLoading(false);
  };

  const isApplications = section === 'applications';
  const list = isApplications ? (tab === 'pending' ? pending : decided) : tab === 'pending' ? pendingCourses : decidedCourses;
  const pendingCount = isApplications ? pending.length : pendingCourses.length;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="font-display text-3xl sm:text-4xl text-gray-900">Review queue</h1>
        <span className="text-sm text-gray-500">{pendingCount} awaiting a decision</span>
      </div>
      <p className="text-gray-500 mb-6">Approve or reject instructor applications and new courses.</p>

      <div className="flex gap-2 mb-4">
        {(['applications', 'courses'] as const).map((s) => (
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
                Instructor applications ({pending.length})
              </>
            ) : (
              <>
                <BookOpen size={15} />
                Courses ({pendingCourses.length})
              </>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-1 mb-6">
        {(['pending', 'decided'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-3.5 py-2 rounded-[10px] font-medium transition ${
              tab === t ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t === 'pending' ? `Pending (${pendingCount})` : 'Recently decided'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <Users size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {tab === 'pending' ? `No ${isApplications ? 'applications' : 'courses'} waiting on a decision` : 'Nothing decided yet'}
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
      setDecideError(err instanceof Error ? err.message : 'Could not record decision');
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
              <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusTint}`}>
                {course.moderation_status}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">
              by {course.instructor?.full_name ?? 'Unknown'} · {course.price > 0 ? `$${course.price}` : 'Free'}
            </p>
          </div>
        </div>
        <span className="text-2xs text-gray-400 flex-shrink-0">{new Date(course.created_at).toLocaleDateString()}</span>
      </button>

      {expanded && (
        <div className="border-t border-canvas-150 p-4 space-y-4">
          <p className="text-sm text-gray-700">{course.description}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Field label="Level" value={course.level} />
            <Field label="Duration" value={`${course.duration_hours}h`} />
            <Field label="Price" value={course.price > 0 ? `$${course.price}` : 'Free'} />
            <Field label="Instructor email" value={course.instructor?.email} />
          </div>

          {course.moderation_status === 'pending' && (
            <div className="pt-3 border-t border-canvas-150">
              <label htmlFor={`course-notes-${course.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Notes (shown to the instructor if rejected)
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
                  {deciding === 'approved' ? 'Approving…' : 'Approve'}
                </button>
                <button
                  onClick={() => handleDecision('rejected')}
                  disabled={deciding !== null}
                  className="flex items-center gap-1.5 bg-red-50 text-red-600 h-10 px-4 rounded-[10px] hover:bg-red-100 transition font-medium disabled:opacity-50"
                >
                  <XCircle size={16} />
                  {deciding === 'rejected' ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </div>
          )}

          {course.moderation_notes && course.moderation_status !== 'pending' && (
            <div className="pt-3 border-t border-canvas-150">
              <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{course.moderation_notes}</p>
            </div>
          )}
        </div>
      )}
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
      setDecideError(err instanceof Error ? err.message : 'Could not record decision');
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
            <p className="font-semibold text-gray-900 truncate">{application.full_name || application.applicant?.full_name || 'Unnamed applicant'}</p>
            <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusTint}`}>
              {application.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">
            {application.applicant?.email} · proposes "{application.proposed_course_title || 'Untitled course'}"
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
                <Field label="Headline" value={application.headline} />
                <Field label="Years of experience" value={application.years_experience?.toString()} />
                <Field label="Address" value={application.address} />
                <Field label="Areas of expertise" value={application.areas_of_expertise?.join(', ')} />
              </div>
              {application.bio && (
                <div>
                  <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">Bio</p>
                  <p className="text-sm text-gray-700">{application.bio}</p>
                </div>
              )}
              {application.qualifications && (
                <div>
                  <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">Qualifications</p>
                  <p className="text-sm text-gray-700">{application.qualifications}</p>
                </div>
              )}

              <div>
                <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-2">Uploaded documents</p>
                {credentials.length === 0 ? (
                  <p className="text-sm text-gray-400">None uploaded yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {credentials.map((c) => (
                      <CredentialRow key={c.id} credential={c} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">Interview</p>
                <p className="text-sm text-gray-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-gray-400" />
                  {interview
                    ? interview.scheduled_at
                      ? `Scheduled ${new Date(interview.scheduled_at).toLocaleString()} — outcome: ${interview.outcome}`
                      : `Outcome: ${interview.outcome}`
                    : 'Not scheduled yet'}
                </p>
              </div>

              {application.status !== 'approved' && application.status !== 'rejected' && (
                <div className="pt-3 border-t border-canvas-150">
                  <label htmlFor={`notes-${application.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                    Decision notes (shown to the applicant if rejected)
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
                      {deciding === 'approved' ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleDecision('rejected')}
                      disabled={deciding !== null}
                      className="flex items-center gap-1.5 bg-red-50 text-red-600 h-10 px-4 rounded-[10px] hover:bg-red-100 transition font-medium disabled:opacity-50"
                    >
                      <XCircle size={16} />
                      {deciding === 'rejected' ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>
                </div>
              )}

              {application.decision_notes && (
                <div className="pt-3 border-t border-canvas-150">
                  <p className="text-2xs font-semibold tracking-[0.06em] uppercase text-gray-500 mb-1">Decision notes</p>
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
          name {credential.verification_name_match ? 'match' : 'mismatch'}
        </span>
      )}
      <button
        onClick={open}
        disabled={loading}
        className="flex items-center gap-1 text-sm text-primary-700 hover:text-primary-800 font-medium flex-shrink-0 disabled:opacity-50"
      >
        <ExternalLink size={14} />
        {loading ? 'Loading…' : 'View'}
      </button>
    </div>
  );
}
