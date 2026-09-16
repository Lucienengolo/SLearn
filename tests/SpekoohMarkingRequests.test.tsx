import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as spekoohLib from '../lib/spekoohMarkingRequests';
import SpekoohMarkingRequests from '../components/Dashboard/SpekoohMarkingRequests';
import * as authContext from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { SpekoohMarkingRequest } from '../lib/spekoohMarkingRequests';

vi.mock('../lib/spekoohMarkingRequests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/spekoohMarkingRequests')>();
  return { ...actual, fetchMyMarkingRequests: vi.fn(), respondToMarkingRequest: vi.fn(), submitMarkingGuide: vi.fn() };
});

function mockAuth() {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'instructor-1', email: 'i@example.com' } as never,
  } as never);
}

const PENDING_REQUEST: SpekoohMarkingRequest = {
  id: 'row-1',
  spekooh_request_id: 5,
  spekooh_paper_id: 7,
  instructor_id: 'instructor-1',
  subject: 'Biology',
  status: 'pending',
  sent_at: '2026-09-16T09:00:00Z',
  responds_by: '2026-09-18T09:00:00Z',
  guide_deadline: null,
  content: null,
  created_at: '2026-09-16T09:00:00Z',
  updated_at: '2026-09-16T09:00:00Z',
};

const ACCEPTED_REQUEST: SpekoohMarkingRequest = {
  ...PENDING_REQUEST,
  spekooh_request_id: 6,
  status: 'accepted',
  guide_deadline: '2026-09-23T09:00:00Z',
};

function renderList() {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <SpekoohMarkingRequests />
      </ToastProvider>
    </LocaleProvider>
  );
}

describe('SpekoohMarkingRequests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
  });

  it('shows an empty state when there are no requests', async () => {
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([]);
    renderList();
    expect(await screen.findByText('No requests yet')).toBeInTheDocument();
  });

  it('lists a pending request with subject and accept/reject actions', async () => {
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING_REQUEST]);
    renderList();

    expect(await screen.findByText('Biology')).toBeInTheDocument();
    expect(screen.getByText('Awaiting your response')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('accepts a request', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING_REQUEST]);
    vi.mocked(spekoohLib.respondToMarkingRequest).mockResolvedValue(undefined);
    renderList();
    await screen.findByText('Biology');

    await user.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() => expect(spekoohLib.respondToMarkingRequest).toHaveBeenCalledWith(5, 'ACCEPTED'));
    expect(await screen.findByText('Request accepted.')).toBeInTheDocument();
  });

  it('rejects a request only after confirming the dialog', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING_REQUEST]);
    vi.mocked(spekoohLib.respondToMarkingRequest).mockResolvedValue(undefined);
    renderList();
    await screen.findByText('Biology');

    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(spekoohLib.respondToMarkingRequest).not.toHaveBeenCalled();

    expect(await screen.findByText('Reject this request?')).toBeInTheDocument();
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(spekoohLib.respondToMarkingRequest).toHaveBeenCalledWith(5, 'REJECTED'));
  });

  it('opens the marking-guide form for an accepted request and submits it', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([ACCEPTED_REQUEST]);
    vi.mocked(spekoohLib.submitMarkingGuide).mockResolvedValue(undefined);
    renderList();
    await screen.findByText('Accepted');

    await user.click(screen.getByRole('button', { name: /write marking guide/i }));
    expect(await screen.findByText('Add one question at a time. Each question has a type, a prompt, and an answer.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Question text (optional)'), 'What is photosynthesis?');
    await user.type(screen.getByPlaceholderText('Expected answer'), 'The process plants use to convert light to energy.');
    await user.click(screen.getByRole('button', { name: /submit marking guide/i }));

    await waitFor(() =>
      expect(spekoohLib.submitMarkingGuide).toHaveBeenCalledWith(6, [
        { question_type: 'SHORT_ANSWER', text: 'What is photosynthesis?', answer: 'The process plants use to convert light to energy.' },
      ])
    );
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([]);

    renderList();

    expect(await screen.findByText('Aucune demande pour le moment')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
