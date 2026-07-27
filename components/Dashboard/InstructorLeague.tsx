import { useState, useEffect } from 'react';
import { fetchInstructorLeague, LeagueRow } from '../../lib/league';
import LeagueBoard from './LeagueBoard';

type InstructorLeagueProps = {
  courses: { id: string; title: string }[];
};

type Scope = 'global' | 'course';

// The instructor's own read-only view of their students' rankings
// (founder request, 2026-07-27): "Global" combines every course they
// teach, "Course" scopes to one course they pick from a dropdown. Both
// call get_instructor_league (0038_league.sql), which enforces that the
// caller can only ever see courses they themselves teach.
export default function InstructorLeague({ courses }: InstructorLeagueProps) {
  const [scope, setScope] = useState<Scope>('global');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(courses[0]?.id ?? null);
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const courseId = scope === 'course' ? selectedCourseId : null;
      if (scope === 'course' && !courseId) {
        if (!cancelled) setRows([]);
      } else {
        const result = await fetchInstructorLeague(courseId);
        if (!cancelled) setRows(result);
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [scope, selectedCourseId]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1 rounded-[10px] bg-gray-100 p-1">
          {(['global', 'course'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`text-sm px-3 py-1.5 rounded-[8px] transition font-medium ${
                scope === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {s === 'global' ? 'Global (all my courses)' : 'Single course'}
            </button>
          ))}
        </div>

        {scope === 'course' && courses.length > 0 && (
          <select
            value={selectedCourseId ?? ''}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="h-10 px-3 rounded-[10px] border border-canvas-150 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : scope === 'course' && courses.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <p className="text-gray-500 text-sm">Create a course to see its league.</p>
        </div>
      ) : (
        <LeagueBoard rows={rows} emptyMessage="No students have earned XP yet." />
      )}
    </div>
  );
}
