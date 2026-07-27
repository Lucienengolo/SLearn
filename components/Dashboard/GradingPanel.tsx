import { useState, useEffect } from 'react';
import { ClassworkPostWithCourse, ClassworkSubmissionWithStudent, fetchSubmissionsForPost, gradeSubmission } from '../../lib/classwork';
import { useToast } from '../../contexts/ToastContext';
import { renderRichText } from '../../lib/richText';

type GradingPanelProps = {
  post: ClassworkPostWithCourse;
  onBack: () => void;
};

function GradeRow({ submission, maxPoints, onGraded }: { submission: ClassworkSubmissionWithStudent; maxPoints: number | null; onGraded: () => void }) {
  const { showToast } = useToast();
  const [grade, setGrade] = useState(submission.grade?.toString() ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const gradeNum = Number(grade);
    if (!grade || Number.isNaN(gradeNum)) {
      showToast('Enter a numeric grade.', 'error');
      return;
    }
    setSaving(true);
    try {
      await gradeSubmission(submission.id, gradeNum, feedback);
      showToast('Grade saved.', 'success');
      onGraded();
    } catch {
      showToast('Failed to save grade.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-canvas-150 p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-medium text-gray-900">{submission.student?.full_name ?? 'Student'}</p>
        <span className="text-2xs text-gray-500">Submitted {new Date(submission.submitted_at).toLocaleDateString()}</span>
      </div>
      <div className="text-sm text-gray-700 mb-3">{renderRichText(submission.content ?? '')}</div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          type="number"
          min={0}
          placeholder={maxPoints ? `/ ${maxPoints}` : 'Grade'}
          className="w-24 h-9 px-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Feedback (optional)"
          className="flex-1 min-w-[160px] h-9 px-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-3.5 rounded-[8px] bg-primary-500 text-gray-900 text-sm font-medium hover:bg-primary-400 transition disabled:opacity-50"
        >
          {submission.grade !== null ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// Drill-in grading view for one assignment -- matches the codebase's
// established pattern of full-page drill-ins (CourseEditor, CourseStudents)
// for anything more complex than a single-field form, rather than a modal.
export default function GradingPanel({ post, onBack }: GradingPanelProps) {
  const [submissions, setSubmissions] = useState<ClassworkSubmissionWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const result = await fetchSubmissionsForPost(post.id);
    setSubmissions(result);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const gradedCount = submissions.filter((s) => s.grade !== null).length;

  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition mb-4">
        ← Back to Classwork
      </button>
      <h2 className="font-display text-2xl text-gray-900 mb-1">{post.title}</h2>
      <p className="text-gray-500 mb-6">
        {submissions.length} submission{submissions.length === 1 ? '' : 's'} · {gradedCount} graded
      </p>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <p className="text-gray-500 text-sm">No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <GradeRow key={submission.id} submission={submission} maxPoints={post.max_points} onGraded={load} />
          ))}
        </div>
      )}
    </div>
  );
}
