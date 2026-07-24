import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddStudentModal from '../components/Dashboard/AddStudentModal';
import * as enrollmentLib from '../lib/instructorEnrollment';

const ONE_COURSE = [{ id: 'course-1', title: 'Course A' }];
const TWO_COURSES = [
  { id: 'course-1', title: 'Course A' },
  { id: 'course-2', title: 'Course B' },
];

describe('AddStudentModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<AddStudentModal isOpen={false} courses={ONE_COURSE} onClose={vi.fn()} onEnrolled={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show a course picker with a single course, and enrolls into it', async () => {
    const user = userEvent.setup();
    const enrollSpy = vi.spyOn(enrollmentLib, 'enrollStudentByEmail').mockResolvedValue(undefined);
    const onEnrolled = vi.fn();
    const onClose = vi.fn();

    render(<AddStudentModal isOpen={true} courses={ONE_COURSE} onClose={onClose} onEnrolled={onEnrolled} />);

    expect(screen.queryByLabelText(/^course$/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/student email/i), 'student@example.com');
    await user.click(screen.getByRole('button', { name: /add student/i }));

    expect(enrollSpy).toHaveBeenCalledWith('course-1', 'student@example.com');
    await waitFor(() => expect(onEnrolled).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a course picker with multiple courses, defaulting to the first', async () => {
    const user = userEvent.setup();
    const enrollSpy = vi.spyOn(enrollmentLib, 'enrollStudentByEmail').mockResolvedValue(undefined);

    render(<AddStudentModal isOpen={true} courses={TWO_COURSES} onClose={vi.fn()} onEnrolled={vi.fn()} />);

    const select = screen.getByLabelText(/^course$/i);
    expect(select).toHaveValue('course-1');

    await user.selectOptions(select, 'course-2');
    await user.type(screen.getByLabelText(/student email/i), 'student@example.com');
    await user.click(screen.getByRole('button', { name: /add student/i }));

    expect(enrollSpy).toHaveBeenCalledWith('course-2', 'student@example.com');
  });

  it('shows an error and keeps the modal open when enrollment fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(enrollmentLib, 'enrollStudentByEmail').mockRejectedValue(new Error('No account found with that email address.'));
    const onClose = vi.fn();

    render(<AddStudentModal isOpen={true} courses={ONE_COURSE} onClose={onClose} onEnrolled={vi.fn()} />);

    await user.type(screen.getByLabelText(/student email/i), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: /add student/i }));

    expect(await screen.findByText(/no account found with that email address/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
