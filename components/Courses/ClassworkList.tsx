import { useState, useEffect } from 'react';
import { Megaphone, FileText, ClipboardList, CheckCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchClassworkPosts,
  fetchMySubmission,
  submitClasswork,
  ClassworkPostWithCourse,
} from '../../lib/classwork';
import { ClassworkSubmission } from '../../lib/supabase';
import { renderRichText } from '../../lib/richText';

type ClassworkListProps = { courseId: string; studentId: string };

const TYPE_META: Record<ClassworkPostWithCourse['type'], { label: string; Icon: typeof Megaphone; tint: string }> = {
  announcement: { label: 'Announcement', Icon: Megaphone, tint: 'bg-gray-100 text-gray-600' },
  material: { label: 'Material', Icon: FileText, tint: 'bg-primary-50 text-primary-700' },
  assignment: { label: 'Assignment', Icon: ClipboardList, tint: 'bg-green-50 text-green-700' },
};

function AssignmentSubmission({
  post,
  submission,
  studentId,
  onSubmitted,
}: {
  post: ClassworkPostWithCourse;
  submission: ClassworkSubmission | null;
  studentId: string;
  onSubmitted: () => void;
}) {
  const { showToast } = useToast();
  const [content, setContent] = useState(submission?.content ?? '');
  const [submitting, setSubmitting] = useState(false);
  const graded = submission?.grade !== null && submission?.grade !== undefined;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitClasswork(post.id, studentId, content);
      showToast(submission ? 'Resubmitted.' : 'Submitted.', 'success');
      onSubmitted();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (graded) {
    return (
      <div className="mt-3 rounded-[10px] bg-green-50 border border-green-100 p-3.5">
        <p className="text-sm font-semibold text-green-800 mb-1">
          Grade: {submission!.grade}
          {post.max_points ? ` / ${post.max_points}` : ''}
        </p>
        {submission!.feedback && <div className="text-sm text-green-700">{renderRichText(submission.feedback)}</div>}
      </div>
    );
  }

  return (
    <div className="mt-3">
      {submission && (
        <p className="text-2xs text-gray-500 mb-1.5 flex items-center gap-1">
          <CheckCircle size={12} className="text-primary-600" />
          Submitted {new Date(submission.submitted_at).toLocaleDateString()} — you can still resubmit before it's graded.
        </p>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your submission..."
        rows={3}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none mb-2"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="bg-primary-500 text-gray-900 h-9 px-4 rounded-[8px] text-sm font-semibold hover:bg-primary-400 transition disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : submission ? 'Resubmit' : 'Submit'}
      </button>
    </div>
  );
}

// Student-facing Classwork feed for one course -- announcements/materials
// are read-only, assignments get an inline submission box (founder request,
// 2026-07-27, Google Classroom-inspired). Hidden entirely when nothing's
// been posted, matching how CourseDetail already omits other empty
// sections (e.g. reviews) rather than showing an empty box.
export default function ClassworkList({ courseId, studentId }: ClassworkListProps) {
  const [posts, setPosts] = useState<ClassworkPostWithCourse[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, ClassworkSubmission | null>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const result = await fetchClassworkPosts([courseId]);
    setPosts(result);

    const assignments = result.filter((p) => p.type === 'assignment');
    const fetched = await Promise.all(assignments.map((p) => fetchMySubmission(p.id, studentId)));
    setSubmissions(Object.fromEntries(assignments.map((p, i) => [p.id, fetched[i]])));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, studentId]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-2xl text-gray-900 mb-4">Classwork</h2>
      <div className="space-y-3">
        {posts.map((post) => {
          const meta = TYPE_META[post.type];
          return (
            <div key={post.id} className="rounded-[14px] border border-canvas-150 p-4 shadow-sm">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-full ${meta.tint}`}>
                  <meta.Icon size={12} />
                  {meta.label}
                </span>
                {post.due_at && (
                  <span className="text-2xs text-gray-500">Due {new Date(post.due_at).toLocaleDateString()}</span>
                )}
                {post.max_points && <span className="text-2xs text-gray-500">{post.max_points} pts</span>}
              </div>
              <p className="font-semibold text-gray-900">{post.title}</p>
              {post.body && <div className="text-sm text-gray-600 mt-1">{renderRichText(post.body)}</div>}
              {post.attachment_url && (
                <a
                  href={post.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary-700 hover:underline mt-2 inline-block"
                >
                  {post.attachment_url}
                </a>
              )}
              {post.type === 'assignment' && (
                <AssignmentSubmission
                  post={post}
                  submission={submissions[post.id] ?? null}
                  studentId={studentId}
                  onSubmitted={load}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
