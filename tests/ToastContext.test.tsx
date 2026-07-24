import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../contexts/ToastContext';

function TestTrigger() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast('Course deleted', 'success')}>Trigger success</button>
      <button onClick={() => showToast('Failed to delete course', 'error')}>Trigger error</button>
    </div>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast with the right message when triggered', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /trigger success/i }));
    expect(screen.getByText('Course deleted')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('dismisses a toast when its close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /trigger error/i }));
    expect(screen.getByText('Failed to delete course')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dismiss notification/i }));
    expect(screen.queryByText('Failed to delete course')).not.toBeInTheDocument();
  });

  it('auto-dismisses a toast after its timeout', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /trigger success/i }));
    expect(screen.getByText('Course deleted')).toBeInTheDocument();

    vi.advanceTimersByTime(6000);
    await waitFor(() => expect(screen.queryByText('Course deleted')).not.toBeInTheDocument());
  });

  it('throws when useToast is called outside a ToastProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestTrigger />)).toThrow(/useToast must be used within a ToastProvider/);
    consoleError.mockRestore();
  });
});
