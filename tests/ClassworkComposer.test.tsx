import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as classworkLib from '../lib/classwork';
import ClassworkComposer from '../components/Dashboard/ClassworkComposer';
import { ToastProvider } from '../contexts/ToastContext';
import { LocaleProvider } from '../contexts/LocaleContext';

vi.mock('../lib/classwork');

const COURSES = [
  { id: 'course-1', title: 'Course A' },
  { id: 'course-2', title: 'Course B' },
];

function renderComposer(props: Partial<Parameters<typeof ClassworkComposer>[0]> = {}) {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <ClassworkComposer
          instructorId="instructor-1"
          courses={props.courses ?? COURSES}
          defaultCourseId={props.defaultCourseId ?? null}
          onPosted={props.onPosted ?? vi.fn()}
        />
      </ToastProvider>
    </LocaleProvider>
  );
}

describe('ClassworkComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classworkLib.createClassworkPost).mockResolvedValue(undefined);
  });

  it('defaults to Announcement, with no due date/points fields', () => {
    renderComposer();
    expect(screen.queryByPlaceholderText('Points')).not.toBeInTheDocument();
  });

  it('shows due date and points fields only for Assignment', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: 'Assignment' }));
    expect(screen.getByPlaceholderText('Points')).toBeInTheDocument();
  });

  // Regression: the 3-pill type selector used a shrink-to-fit flex row
  // (w-fit) with no wrap -- on a narrow phone, "Announcement"/"Assignment"
  // plus icons needed more width than the card had, so "Assignment" (the
  // rightmost pill) overflowed past the screen edge. A 3-column grid can
  // never exceed its container's width, whatever the label length.
  it('lays the type selector out as a 3-column grid so it can never overflow the card width', () => {
    renderComposer();

    const assignmentButton = screen.getByRole('button', { name: 'Assignment' });
    expect(assignmentButton.parentElement).toHaveClass('grid', 'grid-cols-3');
  });

  // Regression: type="date" inputs ignore the placeholder attribute
  // entirely, so the due-date field previously rendered blank with no
  // indication of its purpose (especially confusing on mobile, where it's
  // the only field in the row with nothing visible at all).
  it('gives the due-date field a real label instead of relying on a placeholder', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: 'Assignment' }));
    expect(screen.getByLabelText('Due date')).toBeInTheDocument();
  });

  it('shows a course picker when there are multiple courses', () => {
    renderComposer({ courses: COURSES });
    expect(screen.getByRole('option', { name: 'Course A' })).toBeInTheDocument();
  });

  it('hides the course picker when there is only one course', () => {
    renderComposer({ courses: [COURSES[0]] });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('posts with the selected type and clears the form on success', async () => {
    const user = userEvent.setup();
    const onPosted = vi.fn();
    renderComposer({ courses: [COURSES[0]], onPosted });

    await user.click(screen.getByRole('button', { name: 'Material' }));
    await user.type(screen.getByPlaceholderText('Title'), 'Slides');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(classworkLib.createClassworkPost).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 'course-1', type: 'material', title: 'Slides' })
    );
    await screen.findByText(/posted to the classroom/i);
    expect(screen.getByPlaceholderText('Title')).toHaveValue('');
    expect(onPosted).toHaveBeenCalled();
  });

  it('shows an error toast when posting fails', async () => {
    vi.mocked(classworkLib.createClassworkPost).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderComposer({ courses: [COURSES[0]] });

    await user.type(screen.getByPlaceholderText('Title'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('nope')).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderComposer({ courses: [COURSES[0]] });

    expect(screen.getByRole('button', { name: 'Annonce' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Devoir' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Titre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publier' })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
