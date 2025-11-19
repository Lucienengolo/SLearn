import { useState, useEffect, ChangeEvent } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Upload, X, FileText, Video } from 'lucide-react';
import { supabase, Category } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadLessonVideo, uploadLessonPDF } from '../../lib/storage';

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
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [durationHours, setDurationHours] = useState(0);
  const [price, setPrice] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [saving, setSaving] = useState(false);

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

  const handleSaveCourse = async () => {
    if (!user || !title || !description) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      let finalCourseId = courseId;

      if (courseId) {
        const { error } = await supabase
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

        if (error) throw error;
      } else {
        const { data, error } = await supabase
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

        if (error) throw error;
        finalCourseId = data.id;
      }

      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        if (lesson.id && lesson.id.startsWith('temp-')) {
          await supabase.from('lessons').insert({
            course_id: finalCourseId,
            title: lesson.title,
            description: lesson.description,
            content: lesson.content,
            video_url: lesson.video_url,
            order_index: i,
            duration_minutes: lesson.duration_minutes,
          });
        } else if (lesson.id) {
          await supabase
            .from('lessons')
            .update({
              title: lesson.title,
              description: lesson.description,
              content: lesson.content,
              video_url: lesson.video_url,
              order_index: i,
              duration_minutes: lesson.duration_minutes,
            })
            .eq('id', lesson.id);
        }
      }

      alert('Course saved successfully!');
      onBack();
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Failed to save course');
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
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lesson.id);

      if (error) {
        alert('Failed to delete lesson');
        return;
      }
    }
    setLessons(lessons.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          {courseId ? 'Edit Course' : 'Create New Course'}
        </h1>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Introduction to Web Development"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              placeholder="Describe what students will learn..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                title="Select a course category"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Level
              </label>
              <select
                title="Select course level"
                value={level}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (hours)
              </label>
              <input
                type="number"
                value={durationHours}
                onChange={(e) => setDurationHours(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price ($)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="0"
                step="0.01"
              />
            </div>
          </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course Thumbnail
              </label>
              {thumbnailUrl ? (
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-green-300">
                  <div className="flex items-center space-x-2">
                    <img src={thumbnailUrl} alt="Thumbnail preview" className="w-12 h-12 rounded object-cover" />
                    <span className="text-sm text-gray-700">Thumbnail ready</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setThumbnailUrl('')}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:bg-gray-50">
                  <div className="text-center">
                    <Upload size={24} className="mx-auto text-gray-600 mb-2" />
                    <span className="text-sm text-gray-700">Click to upload thumbnail</span>
                    <span className="text-xs text-gray-500 block mt-1">JPG, PNG (Max 5MB)</span>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setThumbnailUrl(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Lessons</h2>
              <button
                onClick={addLesson}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                <Plus size={18} />
                <span>Add Lesson</span>
              </button>
            </div>

            <div className="space-y-4">
              {lessons.map((lesson, index) => (
                <div key={lesson.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Lesson title"
                      required
                    />
                    <textarea
                      value={lesson.description}
                      onChange={(e) => updateLesson(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={2}
                      placeholder="Lesson description"
                    />

                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-gray-800 mb-3">
                        Lesson Content *
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-700 font-medium mb-1 block">
                            Text Content
                          </label>
                          <textarea
                            value={lesson.content}
                            onChange={(e) => updateLesson(index, 'content', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={3}
                            placeholder="Enter lesson text content (optional)"
                          />
                        </div>

                        <div className="border-t border-primary-200 pt-3">
                          <label className="text-sm text-gray-700 font-medium mb-2 block">
                            Upload Video File (Optional)
                          </label>
                          {lesson.video_file_url ? (
                            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-green-300">
                              <div className="flex items-center space-x-2">
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
                                Remove video file
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center border-2 border-dashed border-primary-300 rounded-lg p-4 cursor-pointer hover:bg-primary-50">
                              <div className="text-center">
                                <Upload size={24} className="mx-auto text-primary-600 mb-1" />
                                <span className="text-sm text-gray-700">Click to upload video</span>
                                <span className="text-xs text-gray-500 block mt-1">MP4, WebM (Max 500MB)</span>
                              </div>
                              <input
                                type="file"
                                accept="video/mp4,video/webm"
                                className="hidden"
                                title="Upload video file"
                                placeholder="Upload video file"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file && courseId) {
                                    const url = await uploadLessonVideo(courseId, lesson.id, file);
                                    if (url) {
                                      updateLesson(index, 'video_file_url', url);
                                    } else {
                                      alert('Failed to upload video');
                                    }
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>

                        <div>
                          <label className="text-sm text-gray-700 font-medium mb-2 block">
                            Upload PDF Notes (Optional)
                          </label>
                          {lesson.pdf_notes_url ? (
                            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-green-300">
                              <div className="flex items-center space-x-2">
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
                            <label className="flex items-center justify-center border-2 border-dashed border-primary-300 rounded-lg p-4 cursor-pointer hover:bg-primary-50">
                              <div className="text-center">
                                <Upload size={24} className="mx-auto text-primary-600 mb-1" />
                                <span className="text-sm text-gray-700">Click to upload PDF notes</span>
                                <span className="text-xs text-gray-500 block mt-1">PDF only (Max 50MB)</span>
                              </div>
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file && courseId) {
                                    const url = await uploadLessonPDF(courseId, lesson.id, file);
                                    if (url) {
                                      updateLesson(index, 'pdf_notes_url', url);
                                    } else {
                                      alert('Failed to upload PDF');
                                    }
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>

                        <p className="text-xs text-gray-600 italic">
                          At least one of text content, video, or PDF notes should be provided
                        </p>
                      </div>
                    </div>

                    <input
                      type="url"
                      value={lesson.video_url}
                      onChange={(e) => updateLesson(index, 'video_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Embed URL (YouTube, Vimeo) - Optional"
                    />

                    <input
                      type="number"
                      value={lesson.duration_minutes}
                      onChange={(e) => updateLesson(index, 'duration_minutes', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Duration (min)"
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
              disabled={saving || !title || !description}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Course'}
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
