import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseCard from '../components/Courses/CourseCard';
import { LocaleProvider } from '../contexts/LocaleContext';
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

function renderCard(props: Partial<Parameters<typeof CourseCard>[0]> = {}) {
  return render(
    <LocaleProvider>
      <CourseCard course={props.course ?? BASE_COURSE} onClick={props.onClick ?? vi.fn()} {...props} />
    </LocaleProvider>
  );
}

describe('CourseCard', () => {
  it('shows a verified badge next to the instructor name when verified', () => {
    renderCard({ course: { ...BASE_COURSE, instructor: { full_name: 'Aïcha Mbarga', verified: true } } });

    expect(screen.getByText('Aïcha Mbarga')).toBeInTheDocument();
    expect(screen.getByLabelText('Verified instructor')).toBeInTheDocument();
  });

  it('does not show a verified badge for an unverified instructor', () => {
    renderCard({ course: { ...BASE_COURSE, instructor: { full_name: 'Junior Ngassa', verified: false } } });

    expect(screen.getByText('Junior Ngassa')).toBeInTheDocument();
    expect(screen.queryByLabelText('Verified instructor')).not.toBeInTheDocument();
  });

  it('renders without an instructor at all (defensive, e.g. mid-migration data)', () => {
    renderCard();
    expect(screen.getByText('Intro to SQL')).toBeInTheDocument();
    expect(screen.queryByLabelText('Verified instructor')).not.toBeInTheDocument();
  });

  it('translates the level label and Free price tag', () => {
    renderCard({ course: { ...BASE_COURSE, level: 'advanced', price: 0 } });
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  // Regression: founder feedback that "the language doesn't apply to all
  // the platform" -- CourseCard's level/price/aria-labels were hardcoded
  // English regardless of the FR/EN toggle.
  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderCard({ course: { ...BASE_COURSE, level: 'beginner', price: 0 } });

    expect(screen.getByText('Débutant')).toBeInTheDocument();
    expect(screen.getByText('Gratuit')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
