import { useEffect, useState } from 'react';
import { ShieldCheck, UserX, UserCheck, Users, BookOpen, Handshake, Megaphone, ScrollText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
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
import { BroadcastAudience, broadcastAnnouncement } from '../../lib/adminBroadcast';
import { AdminActionLogEntry, fetchAdminActionLog } from '../../lib/adminAuditLog';
import type { TranslationKey } from '../../lib/i18n';

// Matches the hardcoded principal email in 0054_admin_role.sql's
// set_admin_access() -- this is only a UX gate (which section to show);
// the real authorization check is server-side in the RPC itself, same
// disclaimer as every other is_reviewer/is_admin-gated surface in this app.
const PRINCIPAL_ADMIN_EMAIL = 'storefix237@gmail.com';

type Section = 'instructors' | 'courses' | 'matches' | 'broadcast' | 'activity-log' | 'admin-access';

const SECTION_LABEL_KEYS: Record<Section, TranslationKey> = {
  instructors: 'dashboard.adminPanel.instructorsTab',
  courses: 'dashboard.adminPanel.coursesTab',
  matches: 'dashboard.adminPanel.matchesTab',
  broadcast: 'dashboard.adminPanel.broadcastTab',
  'activity-log': 'dashboard.adminPanel.activityLogTab',
  'admin-access': 'dashboard.adminPanel.adminAccessTab',
};

const SECTION_ICONS: Record<Section, typeof Users> = {
  instructors: Users,
  courses: BookOpen,
  matches: Handshake,
  broadcast: Megaphone,
  'activity-log': ScrollText,
  'admin-access': ShieldCheck,
};

// Admin-only page (founder request, 2026-08-05/06). Mirrors
// ReviewQueue.tsx's section-switcher shell -- not a new pattern.
export default function AdminPanel() {
  const { t } = useLocale();
  const { profile } = useAuth();
  const isPrincipal = profile?.email === PRINCIPAL_ADMIN_EMAIL;
  const [section, setSection] = useState<Section>('instructors');
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      setInstructors(await fetchAllInstructors());
    } catch {
      setLoadError(t('dashboard.adminPanel.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sections: Section[] = isPrincipal
    ? ['instructors', 'courses', 'matches', 'broadcast', 'activity-log', 'admin-access']
    : ['instructors', 'courses', 'matches', 'broadcast', 'activity-log'];

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('dashboard.adminPanel.title')}</h1>
      <p className="text-gray-500 mb-6">{t('dashboard.adminPanel.subtitle')}</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {sections.map((s) => {
          const Icon = SECTION_ICONS[s];
          return (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-medium transition ${
                section === s
                  ? 'border-primary-200 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:text-gray-900'
              }`}
            >
              <Icon size={15} />
              {t(SECTION_LABEL_KEYS[s])}
            </button>
          );
        })}
      </div>

      {section === 'instructors' && (
        <InstructorsSection instructors={instructors} loading={loading} error={loadError} onChanged={load} />
      )}
      {section === 'courses' && <CoursesSection />}
      {section === 'matches' && <MatchesSection />}
      {section === 'broadcast' && <BroadcastSection />}
      {section === 'activity-log' && <ActivityLogSection />}
      {section === 'admin-access' && isPrincipal && <AdminAccessSection />}
    </div>
  );
}

function InstructorsSection({
  instructors,
  loading,
  error,
  onChanged,
}: {
  instructors: InstructorListItem[];
  loading: boolean;
  error: string;
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
  if (error) return <p className="text-sm text-red-600">{error}</p>;
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

function CoursesSection() {
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

function MatchesSection() {
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
          <p className="text-sm text-gray-500">{m.confirmed_session_date ? new Date(m.confirmed_session_date).toLocaleString() : '—'}</p>
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
