import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseCard from '../components/Courses/CourseCard';
import type { Course } from '../lib/supabase';

const BASE_COURSE: Course = {
  id: 'course-1',
  title: 'Intro to SQL',
  description: 'Learn SQL from scratch',
  instructor_id: 'instructor-1',
  category_id: 'cat-1',
  thumbnail_url: null,
  level: 'beginner',
  duration_hours: 4,
  price: 0,
  is_published: true,
  moderation_status: 'approved',
  moderation_notes: null,
  created_at: '',
  updated_at: '',
};

describe('CourseCard', () => {
  it('shows a verified badge next to the instructor name when verified', () => {
    render(
      <CourseCard
        course={{ ...BASE_COURSE, instructor: { full_name: 'Aïcha Mbarga', verified: true } }}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Aïcha Mbarga')).toBeInTheDocument();
    expect(screen.getByLabelText('Verified instructor')).toBeInTheDocument();
  });

  it('does not show a verified badge for an unverified instructor', () => {
    render(
      <CourseCard
        course={{ ...BASE_COURSE, instructor: { full_name: 'Junior Ngassa', verified: false } }}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Junior Ngassa')).toBeInTheDocument();
    expect(screen.queryByLabelText('Verified instructor')).not.toBeInTheDocument();
  });

  it('renders without an instructor at all (defensive, e.g. mid-migration data)', () => {
    render(<CourseCard course={BASE_COURSE} onClick={vi.fn()} />);
    expect(screen.getByText('Intro to SQL')).toBeInTheDocument();
    expect(screen.queryByLabelText('Verified instructor')).not.toBeInTheDocument();
  });
});
