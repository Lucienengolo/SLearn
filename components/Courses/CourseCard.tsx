import { Clock, Users, Star, Bookmark, CheckCircle } from 'lucide-react';
import { Course } from '../../lib/supabase';
import { getCourseCover } from '../../lib/courseCovers';

type CourseCardProps = {
  course: Course & {
    instructor?: { full_name: string; verified?: boolean };
    category?: { name: string };
    enrollmentCount?: number;
    averageRating?: number;
  };
  onClick: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
};

export default function CourseCard({ course, onClick, isSaved, onToggleSave }: CourseCardProps) {
  const cover = getCourseCover(course.category?.name);
  const CoverIcon = cover.icon;

  return (
    <div
      onClick={onClick}
      className="relative rounded-[14px] border border-canvas-150 overflow-hidden hover:border-gray-300 hover:shadow-md transition cursor-pointer bg-white"
    >
      <div className="h-44 flex items-center justify-center" style={{ background: cover.gradient }}>
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <CoverIcon size={48} className="text-white/50" />
        )}
      </div>
      {onToggleSave && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          aria-label={isSaved ? 'Remove from saved courses' : 'Save course for later'}
          aria-pressed={isSaved}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm transition"
        >
          <Bookmark size={15} className={isSaved ? 'fill-primary-600 text-primary-600' : 'text-gray-500'} />
        </button>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          {course.category && (
            <span className="text-2xs font-semibold tracking-[0.04em] uppercase text-primary-700 bg-primary-50 px-2 py-1 rounded-full">
              {course.category.name}
            </span>
          )}
          <span className="text-2xs text-gray-500 capitalize">{course.level}</span>
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-1.5 line-clamp-2">
          {course.title}
        </h3>
        <p className="text-gray-500 text-sm mb-3 line-clamp-2">
          {course.description}
        </p>
        <div className="flex items-center text-sm text-gray-500 gap-4 mb-3">
          {course.duration_hours > 0 && (
            <div className="flex items-center gap-1">
              <Clock size={15} />
              <span>{course.duration_hours}h</span>
            </div>
          )}
          {course.enrollmentCount !== undefined && (
            <div className="flex items-center gap-1">
              <Users size={15} />
              <span>{course.enrollmentCount}</span>
            </div>
          )}
          {course.averageRating !== undefined && course.averageRating > 0 && (
            <div className="flex items-center gap-1">
              <Star size={15} className="fill-primary-500 text-primary-500" />
              <span>{course.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-canvas-150">
          {course.instructor && (
            <p className="text-sm text-gray-500 truncate flex items-center gap-1">
              <span className="truncate">{course.instructor.full_name}</span>
              {course.instructor.verified && (
                <CheckCircle
                  size={13}
                  className="text-green-600 flex-shrink-0"
                  aria-label="Verified instructor"
                />
              )}
            </p>
          )}
          {course.price > 0 ? (
            <p className="text-base font-bold text-gray-900 flex-shrink-0">
              ${course.price.toFixed(2)}
            </p>
          ) : (
            <p className="text-base font-bold text-green-700 flex-shrink-0">Free</p>
          )}
        </div>
      </div>
    </div>
  );
}
