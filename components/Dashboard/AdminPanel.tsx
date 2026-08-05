import { useEffect, useState } from 'react';
import { ShieldCheck, UserX, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import {
  InstructorListItem,
  fetchAllInstructors,
  deactivateInstructor,
  reactivateInstructor,
  setAdminAccess,
} from '../../lib/instructors';

// Matches the hardcoded principal email in 0054_admin_role.sql's
// set_admin_access() -- this is only a UX gate (which section to show);
// the real authorization check is server-side in the RPC itself, same
// disclaimer as every other is_reviewer/is_admin-gated surface in this app.
const PRINCIPAL_ADMIN_EMAIL = 'storefix237@gmail.com';

type Section = 'instructors' | 'admin-access';

// Admin-only page (founder request, 2026-08-05, prompted by discovering 2
// leftover test-fixture "instructor" accounts in production with no way
// to see or manage them). Mirrors ReviewQueue.tsx's section-switcher
// shell -- not a new pattern.
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

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('dashboard.adminPanel.title')}</h1>
      <p className="text-gray-500 mb-6">{t('dashboard.adminPanel.subtitle')}</p>

      {isPrincipal && (
        <div className="flex gap-2 mb-6">
          {(['instructors', 'admin-access'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-medium transition ${
                section === s
                  ? 'border-primary-200 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:text-gray-900'
              }`}
            >
              {s === 'instructors' ? (
                <>
                  <Users size={15} />
                  {t('dashboard.adminPanel.instructorsTab')}
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  {t('dashboard.adminPanel.adminAccessTab')}
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {section === 'instructors' || !isPrincipal ? (
        <InstructorsSection instructors={instructors} loading={loading} error={loadError} onChanged={load} />
      ) : (
        <AdminAccessSection />
      )}
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
        <InstructorRow key={i.id} instructor={i} onChanged={onChanged} />
      ))}
    </div>
  );
}

function InstructorRow({ instructor, onChanged }: { instructor: InstructorListItem; onChanged: () => void }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleToggle = async () => {
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
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-canvas-150 p-4 flex items-center justify-between gap-4">
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
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
      <button
        onClick={handleToggle}
        disabled={busy}
        className={`flex items-center gap-1.5 h-10 px-4 rounded-[10px] transition font-medium disabled:opacity-50 flex-shrink-0 ${
          instructor.verified ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {instructor.verified ? <UserX size={16} /> : <UserCheck size={16} />}
        {busy ? t('common.loadingEllipsis') : instructor.verified ? t('dashboard.adminPanel.deactivate') : t('dashboard.adminPanel.reactivate')}
      </button>
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
