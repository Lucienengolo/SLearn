import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddStudentModal from '../components/Dashboard/AddStudentModal';
import * as enrollmentLib from '../lib/instructorEnrollment';

describe('AddStudentModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<AddStudentModal isOpen={false} courseId="course-1" onClose={vi.fn()} onEnrolled={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('enrolls a student and calls onEnrolled + onClose on success', async () => {
    const user = userEvent.setup();
    const enrollSpy = vi.spyOn(enrollmentLib, 'enrollStudentByEmail').mockResolvedValue(undefined);
    const onEnrolled = vi.fn();
    const onClose = vi.fn();

    render(<AddStudentModal isOpen={true} courseId="course-1" onClose={onClose} onEnrolled={onEnrolled} />);

    await user.type(screen.getByLabelText(/student email/i), 'student@example.com');
    await user.click(screen.getByRole('button', { name: /add student/i }));

    expect(enrollSpy).toHaveBeenCalledWith('course-1', 'student@example.com');
    await waitFor(() => expect(onEnrolled).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error and keeps the modal open when enrollment fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(enrollmentLib, 'enrollStudentByEmail').mockRejectedValue(new Error('No account found with that email address.'));
    const onClose = vi.fn();

    render(<AddStudentModal isOpen={true} courseId="course-1" onClose={onClose} onEnrolled={vi.fn()} />);

    await user.type(screen.getByLabelText(/student email/i), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: /add student/i }));

    expect(await screen.findByText(/no account found with that email address/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
