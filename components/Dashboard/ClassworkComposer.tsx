import { useState } from 'react';
import { Megaphone, FileText, ClipboardList } from 'lucide-react';
import { ClassworkPostType } from '../../lib/supabase';
import { createClassworkPost } from '../../lib/classwork';
import { useToast } from '../../contexts/ToastContext';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type ClassworkComposerProps = {
  instructorId: string;
  courses: { id: string; title: string }[];
  defaultCourseId: string | null;
  onPosted: () => void;
};

const TYPE_OPTIONS: { type: ClassworkPostType; labelKey: TranslationKey; Icon: typeof Megaphone }[] = [
  { type: 'announcement', labelKey: 'dashboard.classroom.postType.announcement', Icon: Megaphone },
  { type: 'material', labelKey: 'dashboard.classroom.postType.material', Icon: FileText },
  { type: 'assignment', labelKey: 'dashboard.classroom.postType.assignment', Icon: ClipboardList },
];

// The instructor's "post something" composer -- the Google Classroom Stream
// pattern of announcements/materials/assignments all going through one
// entry point. Attachment is a plain link, not a file upload (see
// 0039_classwork.sql for why).
export default function ClassworkComposer({ instructorId, courses, defaultCourseId, onPosted }: ClassworkComposerProps) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const [type, setType] = useState<ClassworkPostType>('announcement');
  const [courseId, setCourseId] = useState(defaultCourseId ?? courses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxPoints, setMaxPoints] = useState('100');
  const [posting, setPosting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      showToast(t('dashboard.classworkComposer.chooseCourseFirst'), 'error');
      return;
    }
    setPosting(true);
    try {
      await createClassworkPost({
        courseId,
        instructorId,
        type,
        title,
        body,
        attachmentUrl,
        dueAt: type === 'assignment' && dueAt ? new Date(dueAt).toISOString() : null,
        maxPoints: type === 'assignment' ? Number(maxPoints) || null : null,
      });
      setTitle('');
      setBody('');
      setAttachmentUrl('');
      setDueAt('');
      showToast(t('dashboard.classworkComposer.postedToClassroom'), 'success');
      onPosted();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('dashboard.classworkComposer.failedToPost'), 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-[14px] border border-canvas-150 p-5 shadow-sm mb-6">
      <div className="flex items-center gap-1 mb-4 rounded-[10px] bg-gray-100 p-1 w-fit">
        {TYPE_OPTIONS.map(({ type: optionType, labelKey, Icon }) => (
          <button
            key={optionType}
            type="button"
            onClick={() => setType(optionType)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[8px] transition font-medium ${
              type === optionType ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={15} />
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('dashboard.classworkComposer.titlePlaceholder')}
          required
          className="h-11 px-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 sm:col-span-1"
        />
        {courses.length > 1 ? (
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="h-11 px-3 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={type === 'announcement' ? t('dashboard.classworkComposer.bodyPlaceholderAnnouncement') : t('dashboard.classworkComposer.bodyPlaceholderOther')}
        rows={3}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 mb-3 resize-none"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <input
          value={attachmentUrl}
          onChange={(e) => setAttachmentUrl(e.target.value)}
          placeholder={t('dashboard.classworkComposer.linkPlaceholder')}
          type="url"
          className="h-11 px-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        {type === 'assignment' && (
          <>
            <input
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              type="date"
              className="h-11 px-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <input
              value={maxPoints}
              onChange={(e) => setMaxPoints(e.target.value)}
              type="number"
              min={1}
              placeholder={t('dashboard.classworkComposer.pointsPlaceholder')}
              className="h-11 px-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={posting || !courseId}
        className="bg-primary-500 text-gray-900 h-10 px-5 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
      >
        {posting ? t('dashboard.classworkComposer.postingEllipsis') : t('dashboard.classworkComposer.post')}
      </button>
    </form>
  );
}
