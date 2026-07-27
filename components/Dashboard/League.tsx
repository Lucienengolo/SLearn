import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchStudentProgress, StudentProgress } from '../../lib/gamification';
import { totemByName } from '../../lib/totems';
import { fetchGlobalLeague, fetchCourseLeague, fetchStudentCourseOptions, LeagueRow, StudentCourseOption } from '../../lib/league';
import DashboardSidebar from './DashboardSidebar';
import LeagueBoard from './LeagueBoard';

type LeagueProps = {
  onBack: () => void;
  onNavigate: (page: string) => void;
};

type Scope = 'global' | 'classroom';

// Two divisions (founder request, 2026-07-27): Global (every student on the
// platform) and Classroom (scoped to a single course a student is enrolled
// in -- picked from a dropdown since a student can share a course with
// several different instructors). The instructor's own read-only view of
// these same rankings lives in InstructorDashboard's League tab, not here.
export default function League({ onBack, onNavigate }: LeagueProps) {
  const { user, profile } = useAuth();
  const [scope, setScope] = useState<Scope>('global');
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [courseOptions, setCourseOptions] = useState<StudentCourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchStudentProgress(user.id).then((result) => {
      if (!cancelled) setProgress(result);
    });
    fetchStudentCourseOptions(user.id).then((options) => {
      if (!cancelled) {
        setCourseOptions(options);
        setSelectedCourseId((current) => current ?? options[0]?.courseId ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Two separate effects, not one keyed on [scope, selectedCourseId] --
  // selectedCourseId changes shortly after mount (once the course dropdown
  // options load), which would otherwise re-trigger the global fetch too
  // even while scope is still 'global', wasting a request and racing two
  // in-flight fetchGlobalLeague() calls against each other.
  useEffect(() => {
    if (scope !== 'global') return;
    let cancelled = false;
    setLoading(true);
    fetchGlobalLeague().then((result) => {
      if (!cancelled) {
        setRows(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  useEffect(() => {
    if (scope !== 'classroom') return;
    if (!selectedCourseId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCourseLeague(selectedCourseId).then((result) => {
      if (!cancelled) {
        setRows(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scope, selectedCourseId]);

  const totem = totemByName(profile?.totem);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
      <DashboardSidebar
        current="league"
        onNavigate={onNavigate}
        fullName={profile?.full_name}
        totem={totem}
        tier={progress?.tier ?? null}
      />
      <div>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition mb-4 lg:hidden">
          ← Back to dashboard
        </button>

        <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">League</h1>
        <p className="text-gray-500 mb-7">See where you rank against other learners.</p>

        <div className="flex items-center gap-1 mb-6 border-b border-canvas-150">
          {(['global', 'classroom'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`text-md px-3 py-2.5 transition ${
                scope === s
                  ? 'font-semibold text-gray-900 border-b-2 border-gray-900 -mb-px'
                  : 'font-medium text-gray-500 hover:text-gray-900'
              }`}
            >
              {s === 'global' ? 'Global League' : 'Classroom League'}
            </button>
          ))}
        </div>

        {scope === 'classroom' && courseOptions.length > 0 && (
          <label className="block mb-5">
            <span className="sr-only">Choose a course</span>
            <select
              value={selectedCourseId ?? ''}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full sm:w-72 h-11 px-3 rounded-[10px] border border-canvas-150 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {courseOptions.map((option) => (
                <option key={option.courseId} value={option.courseId}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : scope === 'classroom' && courseOptions.length === 0 ? (
          <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
            <p className="text-gray-500 text-sm">Enroll in a course to see its classroom league.</p>
          </div>
        ) : (
          <LeagueBoard
            rows={rows}
            emptyMessage={scope === 'global' ? 'No learners ranked yet.' : 'No one in this classroom has earned XP yet.'}
          />
        )}
      </div>
    </div>
  );
}
