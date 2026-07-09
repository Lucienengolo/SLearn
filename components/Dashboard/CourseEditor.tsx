import { useState, useEffect, ChangeEvent } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Upload, X, FileText, Video } from 'lucide-react';
import { supabase, Category } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadLessonVideo, uploadLessonPDF, uploadCourseThumbnail } from '../../lib/storage';

const MAX_THUMBNAIL_MB = 5;
const MAX_VIDEO_MB = 500;
const MAX_PDF_MB = 50;

type Lesson = {
  id: string;
  title: string;
  description: string;
  content: string;
  video_url?: string;
  video_file_url?: string;
  pdf_notes_url?: string;
  file_upload_type?: string;
  duration_minutes: number;
  order_index?: number;
};

type CourseEditorProps = {
  courseId: string | null;
  onBack: () => void;
};

export default function CourseEditor({ courseId, onBack }: CourseEditorProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [durationHours, setDurationHours] = useState(0);
  const [price, setPrice] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchCategories();
    if (courseId) {
      fetchCourse();
    }
  }, [courseId]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (data) setCategories(data);
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategoryId(existing.id);
      setAddingCategory(false);
      setNewCategoryName('');
      return;
    }

    setCreatingCategory(true);
    setError('');
    try {
      const { data, error: insertError } = await supabase
        .from('categories')
        .insert({ name })
        .select()
        .single();

      if (insertError) throw insertError;

      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(data.id);
      setAddingCategory(false);
      setNewCategoryName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const fetchCourse = async () => {
    if (!courseId) return;

    const { data: courseData } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseData) {
      setTitle(courseData.title);
      setDescription(courseData.description);
      setCategoryId(courseData.category_id || '');
      setLevel(courseData.level);
      setDurationHours(courseData.duration_hours);
      setPrice(courseData.price);
      setThumbnailUrl(courseData.thumbnail_url || '');

      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (lessonsData) setLessons(lessonsData);
    }
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Course title is required.';
    if (!description.trim()) return 'Course description is required.';
    for (let i = 0; i < lessons.length; i++) {
      const l = lessons[i];
      if (!l.title.trim()) return `Lesson ${i + 1} needs a title.`;
      if (!l.content?.trim() && !l.video_url?.trim() && !l.video_file_url && !l.pdf_notes_url) {
        return `Lesson ${i + 1} ("${l.title}") needs at least one of: text content, video, or PDF notes.`;
      }
    }
    return null;
  };

  const handleSaveCourse = async () => {
    if (!user) return;
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      let finalCourseId = courseId;

      if (courseId) {
        const { error: updateError } = await supabase
          .from('courses')
          .update({
            title,
            description,
            category_id: categoryId || null,
            level,
            duration_hours: durationHours,
            price,
            thumbnail_url: thumbnailUrl || null,
          })
          .eq('id', courseId);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('courses')
          .insert({
            title,
            description,
            instructor_id: user.id,
            category_id: categoryId || null,
            level,
            duration_hours: durationHours,
            price,
            thumbnail_url: thumbnailUrl || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        finalCourseId = data.id;
      }

      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        const payload = {
          title: lesson.title,
          description: lesson.description,
          content: lesson.content,
          video_url: lesson.video_url || null,
          video_file_url: lesson.video_file_url || null,
          pdf_notes_url: lesson.pdf_notes_url || null,
          order_index: i,
          duration_minutes: lesson.duration_minutes,
        };
        if (lesson.id && lesson.id.startsWith('temp-')) {
          await supabase.from('lessons').insert({ course_id: finalCourseId, ...payload });
        } else if (lesson.id) {
          await supabase.from('lessons').update(payload).eq('id', lesson.id);
        }
      }

      setSuccess('Course saved.');
      setTimeout(onBack, 700);
    } catch (err) {
      console.error('Error saving course:', err);
      setError(err instanceof Error ? err.message : 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const addLesson = () => {
    setLessons([
      ...lessons,
      {
        id: `temp-${Date.now()}`,
        title: '',
        description: '',
        content: '',
        video_url: '',
        video_file_url: '',
        pdf_notes_url: '',
        file_upload_type: '',
        duration_minutes: 0,
      },
    ]);
  };

  const updateLesson = <K extends keyof Lesson>(index: number, field: K, value: Lesson[K]) => {
    const newLessons = [...lessons];
    newLessons[index] = { ...newLessons[index], [field]: value } as Lesson;
    setLessons(newLessons);
  };

  const removeLesson = async (index: number) => {
    const lesson = lessons[index];
    if (lesson.id && !lesson.id.startsWith('temp-')) {
      const { error: deleteError } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lesson.id);

      if (deleteError) {
        setError('Failed to delete lesson');
        return;
      }
    }
    setLessons(lessons.filter((_, i) => i !== index));
  };

  const handleThumbnailUpload = async (file: File) => {
    if (!user) return;
    if (file.size > MAX_THUMBNAIL_MB * 1024 * 1024) {
      setError(`Thumbnail must be under ${MAX_THUMBNAIL_MB}MB.`);
      return;
    }
    setError('');
    setUploadingThumbnail(true);
    try {
      const url = await uploadCourseThumbnail(user.id, file);
      if (url) {
        setThumbnailUrl(url);
      } else {
        setError('Failed to upload thumbnail');
      }
    } finally {
      setUploadingThumbnail(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-6"
      >
        <ArrowLeft size={16} />
        <span>Back to dashboard</span>
      </button>

      <div className="rounded-[14px] border border-canvas-150 p-6 md:p-8">
        <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-8">
          {courseId ? 'Edit course' : 'Create new course'}
        </h1>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-[10px] text-sm mb-6">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-3 rounded-[10px] text-sm mb-6">{success}</div>}

        <div className="space-y-6">
          <div>
            <label htmlFor="course-title" className="block text-sm font-medium text-gray-700 mb-2">
              Course Title *
            </label>
            <input
              id="course-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              placeholder="Introduction to Web Development"
              required
            />
          </div>

          <div>
            <label htmlFor="course-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="course-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              rows={4}
              placeholder="Describe what students will learn..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="course-category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              {addingCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                    placeholder="New category name"
                    autoFocus
                    className="flex-1 px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={creatingCategory || !newCategoryName.trim()}
                    className="px-3.5 rounded-[10px] bg-primary-500 text-gray-900 hover:bg-primary-400 transition font-medium text-sm disabled:opacity-50 flex-shrink-0"
                  >
                    {creatingCategory ? 'Adding…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCategory(false);
                      setNewCategoryName('');
                    }}
                    className="px-3 rounded-[10px] text-gray-500 hover:bg-gray-100 transition flex-shrink-0"
                    aria-label="Cancel new category"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    id="course-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    title="Select a course category"
                    className="flex-1 px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAddingCategory(true)}
                    className="flex items-center gap-1 px-3 rounded-[10px] border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition flex-shrink-0 whitespace-nowrap"
                  >
                    <Plus size={14} />
                    New
                  </button>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="course-level" className="block text-sm font-medium text-gray-700 mb-2">
                Level
              </label>
              <select
                id="course-level"
                title="Select course level"
                value={level}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label htmlFor="course-duration" className="block text-sm font-medium text-gray-700 mb-2">
                Duration (hours)
              </label>
              <input
                id="course-duration"
                type="number"
                value={durationHours}
                onChange={(e) => setDurationHours(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                min="0"
              />
            </div>

            <div>
              <label htmlFor="course-price" className="block text-sm font-medium text-gray-700 mb-2">
                Price ($)
              </label>
              <input
                id="course-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                min="0"
                step="0.01"
              />
            </div>
          </div>

            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                Course thumbnail
              </p>
              {thumbnailUrl ? (
                <div className="flex items-center justify-between bg-white p-3 rounded-[10px] border border-green-300">
                  <div className="flex items-center gap-2">
                    <img src={thumbnailUrl} alt="Thumbnail preview" className="w-12 h-12 rounded-[10px] object-cover" />
                    <span className="text-sm text-gray-700">Thumbnail ready</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setThumbnailUrl('')}
                    className="p-3 text-red-600 hover:text-red-700"
                    aria-label="Remove thumbnail"
                    title="Remove thumbnail"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-[10px] p-6 cursor-pointer hover:bg-gray-50">
                  <div className="text-center">
                    <Upload size={24} className="mx-auto text-gray-500 mb-2" />
                    <span className="text-sm text-gray-700">{uploadingThumbnail ? 'Uploading…' : 'Click to upload thumbnail'}</span>
                    <span className="text-2xs text-gray-500 block mt-1">JPG, PNG (Max {MAX_THUMBNAIL_MB}MB)</span>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    disabled={uploadingThumbnail}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleThumbnailUpload(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>

          <div className="border-t border-canvas-150 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-2xl text-gray-900">Lessons</h2>
              <button
                onClick={addLesson}
                className="flex items-center gap-1.5 bg-primary-500 text-gray-900 h-10 px-4 rounded-[10px] hover:bg-primary-400 transition font-medium"
              >
                <Plus size={16} />
                <span>Add lesson</span>
              </button>
            </div>

            <div className="space-y-4">
              {lessons.map((lesson, index) => (
                <div key={lesson.id} className="border border-canvas-150 rounded-[10px] p-4 bg-canvas-25">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <GripVertical size={20} className="text-gray-400" />
                      <span className="font-medium text-gray-700">Lesson {index + 1}</span>
                    </div>
                    <button
                      aria-label={`Delete lesson ${index + 1}`}
                      title={`Delete lesson ${index + 1}`}
                      onClick={() => removeLesson(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={lesson.title}
                      onChange={(e) => updateLesson(index, 'title', e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                      placeholder="Lesson title"
                      aria-label={`Lesson ${index + 1} title`}
                      required
                    />
                    <textarea
                      value={lesson.description}
                      onChange={(e) => updateLesson(index, 'description', e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                      rows={2}
                      placeholder="Lesson description"
                      aria-label={`Lesson ${index + 1} description`}
                    />

                    <div className="bg-primary-50 border border-primary-200 rounded-[10px] p-4">
                      <p className="text-sm font-semibold text-gray-800 mb-3">
                        Lesson content *
                      </p>
                      {!courseId && (
                        <p className="text-2xs text-primary-700 bg-white border border-primary-200 rounded-[10px] px-3 py-2 mb-3">
                          Save the course once (with a title and description) to unlock video/PDF uploads for this lesson.
                          Text content works right away.
                        </p>
                      )}
                      <div className="space-y-3">
                        <div>
                          <label htmlFor={`lesson-content-${lesson.id}`} className="text-sm text-gray-700 font-medium mb-1 block">
                            Text content
                          </label>
                          <textarea
                            id={`lesson-content-${lesson.id}`}
                            value={lesson.content}
                            onChange={(e) => updateLesson(index, 'content', e.target.value)}
                            className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                            rows={3}
                            placeholder="Enter lesson text content (optional)"
                          />
                        </div>

                        <div className="border-t border-primary-200 pt-3">
                          <p className="text-sm text-gray-700 font-medium mb-2 block">
                            Upload video file (optional)
                          </p>
                          {lesson.video_file_url ? (
                            <div className="flex items-center justify-between bg-white p-3 rounded-[10px] border border-green-300">
                              <div className="flex items-center gap-2">
                                <Video size={18} className="text-green-600" />
                                <span className="text-sm text-gray-700">Video uploaded</span>
                              </div>
                              <button
                                type="button"
                                title="Remove video file"
                                aria-label="Remove video file"
                                onClick={() => updateLesson(index, 'video_file_url', '')}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <label
                              className={`flex items-center justify-center border-2 border-dashed rounded-[10px] p-4 transition ${
                                courseId ? 'border-primary-300 cursor-pointer hover:bg-primary-50' : 'border-gray-200 cursor-not-allowed opacity-60'
                              }`}
                            >
                              <div className="text-center">
                                <Upload size={24} className={`mx-auto mb-1 ${courseId ? 'text-primary-600' : 'text-gray-400'}`} />
                                <span className="text-sm text-gray-700">Click to upload video</span>
                                <span className="text-2xs text-gray-500 block mt-1">MP4, WebM (Max {MAX_VIDEO_MB}MB)</span>
                              </div>
                              <input
                                type="file"
                                accept="video/mp4,video/webm"
                                className="hidden"
                                disabled={!courseId}
                                title="Upload video file"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = '';
                                  if (!file || !courseId) return;
                                  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
                                    setError(`Video must be under ${MAX_VIDEO_MB}MB.`);
                                    return;
                                  }
                                  setError('');
                                  const url = await uploadLessonVideo(courseId, lesson.id, file);
                                  if (url) {
                                    updateLesson(index, 'video_file_url', url);
                                  } else {
                                    setError('Failed to upload video');
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>

                        <div>
                          <p className="text-sm text-gray-700 font-medium mb-2 block">
                            Upload PDF notes (optional)
                          </p>
                          {lesson.pdf_notes_url ? (
                            <div className="flex items-center justify-between bg-white p-3 rounded-[10px] border border-green-300">
                              <div className="flex items-center gap-2">
                                <FileText size={18} className="text-green-600" />
                                <span className="text-sm text-gray-700">PDF uploaded</span>
                              </div>
                              <button
                                type="button"
                                title="Remove PDF notes"
                                aria-label={`Remove PDF notes for lesson ${index + 1}`}
                                onClick={() => updateLesson(index, 'pdf_notes_url', '')}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X size={18} />
                                <span className="sr-only">Remove PDF notes</span>
                              </button>
                            </div>
                          ) : (
                            <label
                              className={`flex items-center justify-center border-2 border-dashed rounded-[10px] p-4 transition ${
                                courseId ? 'border-primary-300 cursor-pointer hover:bg-primary-50' : 'border-gray-200 cursor-not-allowed opacity-60'
                              }`}
                            >
                              <div className="text-center">
                                <Upload size={24} className={`mx-auto mb-1 ${courseId ? 'text-primary-600' : 'text-gray-400'}`} />
                                <span className="text-sm text-gray-700">Click to upload PDF notes</span>
                                <span className="text-2xs text-gray-500 block mt-1">PDF only (Max {MAX_PDF_MB}MB)</span>
                              </div>
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                disabled={!courseId}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = '';
                                  if (!file || !courseId) return;
                                  if (file.size > MAX_PDF_MB * 1024 * 1024) {
                                    setError(`PDF must be under ${MAX_PDF_MB}MB.`);
                                    return;
                                  }
                                  setError('');
                                  const url = await uploadLessonPDF(courseId, lesson.id, file);
                                  if (url) {
                                    updateLesson(index, 'pdf_notes_url', url);
                                  } else {
                                    setError('Failed to upload PDF');
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>

                        <p className="text-2xs text-gray-500 italic">
                          At least one of text content, video, or PDF notes is required
                        </p>
                      </div>
                    </div>

                    <input
                      type="url"
                      value={lesson.video_url}
                      onChange={(e) => updateLesson(index, 'video_url', e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                      placeholder="Embed URL (YouTube, Vimeo) - Optional"
                      aria-label={`Lesson ${index + 1} embed URL`}
                    />

                    <input
                      type="number"
                      value={lesson.duration_minutes}
                      onChange={(e) => updateLesson(index, 'duration_minutes', parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                      placeholder="Duration (min)"
                      aria-label={`Lesson ${index + 1} duration in minutes`}
                      min="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              onClick={handleSaveCourse}
              disabled={saving}
              className="flex-1 bg-primary-500 text-gray-900 h-12 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save course'}
            </button>
            <button
              onClick={onBack}
              className="px-6 h-12 bg-gray-100 text-gray-700 rounded-[10px] hover:bg-gray-200 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
