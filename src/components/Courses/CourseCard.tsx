import { Clock, Users, Star } from 'lucide-react';
import { Course } from '../../lib/supabase';

type CourseCardProps = {
  course: Course & {
    instructor?: { full_name: string };
    category?: { name: string };
    enrollmentCount?: number;
    averageRating?: number;
  };
  onClick: () => void;
};

export default function CourseCard({ course, onClick }: CourseCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer"
    >
      <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-6xl text-white opacity-50">📚</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          {course.category && (
            <span className="text-xs bg-blue-100 text-primary-600 px-2 py-1 rounded">
              {course.category.name}
            </span>
          )}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {course.level}
          </span>
        </div>
        <h3 className="font-bold text-lg text-gray-800 mb-2 line-clamp-2">
          {course.title}
        </h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {course.description}
        </p>
        <div className="flex items-center text-sm text-gray-500 space-x-4 mb-3">
          {course.duration_hours > 0 && (
            <div className="flex items-center space-x-1">
              <Clock size={16} />
              <span>{course.duration_hours}h</span>
            </div>
          )}
          {course.enrollmentCount !== undefined && (
            <div className="flex items-center space-x-1">
              <Users size={16} />
              <span>{course.enrollmentCount}</span>
            </div>
          )}
          {course.averageRating !== undefined && course.averageRating > 0 && (
            <div className="flex items-center space-x-1">
              <Star size={16} className="fill-yellow-400 text-yellow-400" />
              <span>{course.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        {course.instructor && (
          <p className="text-sm text-gray-600">
            by {course.instructor.full_name}
          </p>
        )}
        {course.price > 0 ? (
          <p className="text-lg font-bold text-primary-600 mt-2">
            ${course.price.toFixed(2)}
          </p>
        ) : (
          <p className="text-lg font-bold text-green-600 mt-2">Free</p>
        )}
      </div>
    </div>
  );
}
