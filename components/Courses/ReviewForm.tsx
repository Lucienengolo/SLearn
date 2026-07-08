import { useState } from 'react';
import { Star } from 'lucide-react';
import { supabase, Review } from '../../lib/supabase';

type ReviewFormProps = {
  courseId: string;
  userId: string;
  existingReview: Review | null;
  onSubmitted: () => void;
};

// Only rendered for signed-in, enrolled, non-instructor students (see
// CourseDetail) -- matches the "enrolled students write their own review"
// RLS policy on the reviews table exactly, so this form can't produce a
// request RLS would reject anyway.
export default function ReviewForm({ courseId, userId, existingReview, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(!existingReview);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Pick a star rating first');
      return;
    }
    setSubmitting(true);
    setError('');

    const { error: submitError } = existingReview
      ? await supabase
          .from('reviews')
          .update({ rating, comment: comment.trim() || null })
          .eq('id', existingReview.id)
      : await supabase
          .from('reviews')
          .insert({ student_id: userId, course_id: courseId, rating, comment: comment.trim() || null });

    setSubmitting(false);
    if (submitError) {
      setError('Could not save your review. Try again.');
      return;
    }
    setOpen(false);
    onSubmitted();
  };

  if (!open) {
    return (
      <div className="rounded-[14px] border border-canvas-150 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={16} className={i < rating ? 'fill-primary-500 text-primary-500' : 'text-gray-300'} />
          ))}
          <span className="text-sm text-gray-500">Your review</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-sm font-medium text-primary-700 hover:text-primary-800 transition">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-canvas-150 p-4">
      <p className="font-semibold text-gray-900 mb-2.5">{existingReview ? 'Edit your review' : 'Leave a review'}</p>
      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: 5 }).map((_, i) => {
          const value = i + 1;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
              className="p-0.5"
            >
              <Star
                size={22}
                className={value <= (hoverRating || rating) ? 'fill-primary-500 text-primary-500' : 'text-gray-300'}
              />
            </button>
          );
        })}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What did you think of this course? (optional)"
        rows={3}
        className="w-full px-3.5 py-2 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 mb-3"
      />
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-primary-500 text-gray-900 hover:bg-primary-400 transition font-semibold h-10 px-4 rounded-[10px] disabled:opacity-50"
        >
          {submitting ? 'Saving…' : existingReview ? 'Save changes' : 'Submit review'}
        </button>
        {existingReview && (
          <button
            onClick={() => setOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-800 transition px-3"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
