import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as spekoohLib from '../lib/spekoohMarkingRequests';
import SpekoohMarkingRequests from '../components/Dashboard/SpekoohMarkingRequests';
import { DRAFT_SAVE_DELAY_MS } from '../components/Dashboard/SpekoohMarkingGuideForm';
import * as authContext from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { SpekoohMarkingRequest } from '../lib/spekoohMarkingRequests';

vi.mock('../lib/spekoohMarkingRequests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/spekoohMarkingRequests')>();
  return {
    ...actual,
    fetchMyMarkingRequests: vi.fn(),
    respondToMarkingRequest: vi.fn(),
    submitMarkingGuide: vi.fn(),
    uploadGuideFile: vi.fn(),
    submitMarkingGuideFile: vi.fn(),
    fetchPaperLink: vi.fn(),
    saveGuideDraft: vi.fn(),
    fetchEarnings: vi.fn(),
  };
});

function mockAuth() {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'instructor-1', email: 'i@example.com' } as never,
  } as never);
}

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();

function makeRequest(overrides: Partial<SpekoohMarkingRequest>): SpekoohMarkingRequest {
  return {
    id: 'row-1',
    spekooh_request_id: 5,
    spekooh_paper_id: 7,
    instructor_id: 'instructor-1',
    subject: 'Biology',
    status: 'pending',
    sent_at: hoursFromNow(-3),
    responds_by: hoursFromNow(40),
    guide_deadline: null,
    content: null,
    paper_file_url: null,
    guide_storage_path: null,
    category: 'secondary',
    category_title: 'Secondary',
    exam_type: 'O Level',
    system: 'anglophone',
    track: null,
    exam_board: 'GCE Board',
    exam_year: 2022,
    language: 'en',
    report_title: null,
    report_institution: null,
    report_discipline: null,
    responded_at: null,
    submitted_at: null,
    decline_reason: null,
    draft_content: null,
    draft_saved_at: null,
    created_at: hoursFromNow(-3),
    updated_at: hoursFromNow(-3),
    ...overrides,
  };
}

const PENDING = makeRequest({});
const ACCEPTED = makeRequest({
  id: 'row-2',
  spekooh_request_id: 6,
  subject: 'Chemistry',
  status: 'accepted',
  responded_at: hoursFromNow(-2),
  guide_deadline: hoursFromNow(24 * 6),
});

function renderWorkspace() {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <SpekoohMarkingRequests />
      </ToastProvider>
    </LocaleProvider>
  );
}

const PDF_LINK = {
  kind: 'ok' as const,
  link: {
    url: 'https://storage.example/paper.pdf?sig=abc',
    expires_in: 900,
    file_name: 'paper.pdf',
    content_type: 'application/pdf',
    request_status: 'PENDING',
  },
};

async function openRequest(user: ReturnType<typeof userEvent.setup>, subject: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(subject) }));
}

describe('SpekoohMarkingRequests inbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
    vi.mocked(spekoohLib.fetchPaperLink).mockResolvedValue(PDF_LINK);
  });

  it('shows an empty state when there are no requests', async () => {
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([]);
    renderWorkspace();
    expect(await screen.findByText('No requests yet')).toBeInTheDocument();
  });

  it('groups requests into tabs with counts and switches between them', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([
      PENDING,
      ACCEPTED,
      makeRequest({ id: 'row-3', spekooh_request_id: 7, subject: 'Physics', status: 'submitted', submitted_at: hoursFromNow(-1) }),
      makeRequest({ id: 'row-4', spekooh_request_id: 8, subject: 'History', status: 'rejected' }),
    ]);
    renderWorkspace();

    expect(await screen.findByText('Biology')).toBeInTheDocument();
    expect(screen.queryByText('Chemistry')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /needs response/i })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /in progress/i })).toHaveTextContent('1');

    await user.click(screen.getByRole('tab', { name: /in progress/i }));
    expect(screen.getByText('Chemistry')).toBeInTheDocument();
    expect(screen.queryByText('Biology')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /closed/i }));
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('moves an unanswered request past its deadline to Closed and labels it Expired', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([makeRequest({ responds_by: hoursFromNow(-1) })]);
    renderWorkspace();

    expect(await screen.findByText('Nothing is waiting for your answer.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /closed/i }));
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows the paper facts an instructor needs before opening a request', async () => {
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    renderWorkspace();

    const facts = await screen.findByRole('list', { name: 'Paper details' });
    expect(within(facts).getByText('O Level')).toBeInTheDocument();
    expect(within(facts).getByText('2022')).toBeInTheDocument();
    expect(within(facts).getByText('Anglophone')).toBeInTheDocument();
    expect(within(facts).getByText('GCE Board')).toBeInTheDocument();
    expect(within(facts).getByText('EN')).toBeInTheDocument();
  });

  it('warns when a request needs an answer within 12 hours', async () => {
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([makeRequest({ responds_by: hoursFromNow(5) })]);
    renderWorkspace();
    expect(await screen.findByText(/within 12 hours/i)).toBeInTheDocument();
  });

  it('does not warn when the deadline is comfortably far away', async () => {
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    renderWorkspace();
    await screen.findByText('Biology');
    expect(screen.queryByText(/within 12 hours/i)).not.toBeInTheDocument();
  });

  it('filters the current tab by search text', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([
      PENDING,
      makeRequest({ id: 'row-9', spekooh_request_id: 9, subject: 'Geography', exam_type: 'A Level' }),
    ]);
    renderWorkspace();
    await screen.findByText('Biology');

    await user.type(screen.getByRole('searchbox'), 'a level');
    expect(screen.getByText('Geography')).toBeInTheDocument();
    expect(screen.queryByText('Biology')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No requests match your search.')).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([]);

    renderWorkspace();

    expect(await screen.findByText('Aucune demande pour le moment')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('SpekoohMarkingRequests request page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
    vi.mocked(spekoohLib.fetchPaperLink).mockResolvedValue(PDF_LINK);
  });

  it('shows the real paper inline from a freshly requested link', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    renderWorkspace();
    await openRequest(user, 'Biology');

    const frame = await screen.findByTitle('Question paper');
    expect(frame).toHaveAttribute('src', 'https://storage.example/paper.pdf?sig=abc');
    expect(spekoohLib.fetchPaperLink).toHaveBeenCalledWith(5);
    expect(screen.getByRole('link', { name: /open in new tab/i })).toHaveAttribute('href', 'https://storage.example/paper.pdf?sig=abc');
  });

  it('renders an image paper as an image', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchPaperLink).mockResolvedValue({
      kind: 'ok',
      link: { ...PDF_LINK.link, content_type: 'image/jpeg', file_name: 'scan.jpg' },
    });
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    renderWorkspace();
    await openRequest(user, 'Biology');

    expect(await screen.findByRole('img', { name: 'Question paper' })).toBeInTheDocument();
  });

  it('explains when the paper is no longer available', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchPaperLink).mockResolvedValue({ kind: 'gone' });
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    renderWorkspace();
    await openRequest(user, 'Biology');

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  });

  it('offers a retry when the paper fails to load, and loads it on retry', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchPaperLink).mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce(PDF_LINK);
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    renderWorkspace();
    await openRequest(user, 'Biology');

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByTitle('Question paper')).toBeInTheDocument();
    expect(spekoohLib.fetchPaperLink).toHaveBeenCalledTimes(2);
  });

  it('asks the instructor to reload once the short-lived link is about to expire', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchPaperLink).mockResolvedValue({ kind: 'ok', link: { ...PDF_LINK.link, expires_in: 1 } });
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    renderWorkspace();
    await openRequest(user, 'Biology');
    await screen.findByTitle('Question paper');

    expect(await screen.findByText(/view has expired/i, {}, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reload paper/i }));
    await waitFor(() => expect(spekoohLib.fetchPaperLink).toHaveBeenCalledTimes(2));
  });

  it('accepts a request from its page', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    vi.mocked(spekoohLib.respondToMarkingRequest).mockResolvedValue(undefined);
    renderWorkspace();
    await openRequest(user, 'Biology');

    await user.click(await screen.findByRole('button', { name: /^accept$/i }));

    await waitFor(() => expect(spekoohLib.respondToMarkingRequest).toHaveBeenCalledWith(5, 'ACCEPTED', undefined));
    expect(await screen.findByText('Request accepted.')).toBeInTheDocument();
  });

  it('rejects only after confirming, and sends the reason given', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    vi.mocked(spekoohLib.respondToMarkingRequest).mockResolvedValue(undefined);
    renderWorkspace();
    await openRequest(user, 'Biology');

    await user.click(await screen.findByRole('button', { name: /^reject$/i }));
    expect(spekoohLib.respondToMarkingRequest).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByLabelText(/reason/i), 'Outside my subject area');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(spekoohLib.respondToMarkingRequest).toHaveBeenCalledWith(5, 'REJECTED', 'Outside my subject area'));
  });

  it('can cancel out of the reject dialog without responding', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([PENDING]);
    renderWorkspace();
    await openRequest(user, 'Biology');

    await user.click(await screen.findByRole('button', { name: /^reject$/i }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(spekoohLib.respondToMarkingRequest).not.toHaveBeenCalled();
  });

  it('shows the timeline with the reason for a rejected request', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([
      makeRequest({ status: 'rejected', responded_at: hoursFromNow(-1), decline_reason: 'No time this week' }),
    ]);
    renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: /closed/i }));
    await openRequest(user, 'Biology');

    expect(await screen.findByText('You rejected the request')).toBeInTheDocument();
    expect(screen.getByText(/No time this week/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument();
  });

  it('tells the instructor when the response window has closed and offers no actions', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([makeRequest({ responds_by: hoursFromNow(-2) })]);
    renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: /closed/i }));
    await openRequest(user, 'Biology');

    expect(await screen.findByText(/response window closed, and the paper was offered/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument();
  });

  it('submits the marking guide from the same page as the paper', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([ACCEPTED]);
    vi.mocked(spekoohLib.submitMarkingGuide).mockResolvedValue(undefined);
    renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: /in progress/i }));
    await openRequest(user, 'Chemistry');

    expect(await screen.findByTitle('Question paper')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Question text (optional)'), 'What is photosynthesis?');
    await user.type(screen.getByPlaceholderText('Expected answer'), 'How plants turn light into energy.');
    await user.click(screen.getByRole('button', { name: /submit marking guide/i }));

    await waitFor(() =>
      expect(spekoohLib.submitMarkingGuide).toHaveBeenCalledWith(6, [
        { question_type: 'SHORT_ANSWER', text: 'What is photosynthesis?', answer: 'How plants turn light into energy.' },
      ])
    );
  });

  it('refuses to submit a question that has no answer', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([ACCEPTED]);
    renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: /in progress/i }));
    await openRequest(user, 'Chemistry');

    await user.type(await screen.findByPlaceholderText('Question text (optional)'), 'Only a prompt');
    await user.click(screen.getByRole('button', { name: /submit marking guide/i }));

    expect(await screen.findByText('Give an answer for every question before submitting.')).toBeInTheDocument();
    expect(spekoohLib.submitMarkingGuide).not.toHaveBeenCalled();
  });

  it('uploads a file and submits a question-type tally instead of the full form', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([ACCEPTED]);
    vi.mocked(spekoohLib.uploadGuideFile).mockResolvedValue('instructor-1/6-123456.pdf');
    vi.mocked(spekoohLib.submitMarkingGuideFile).mockResolvedValue(undefined);
    renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: /in progress/i }));
    await openRequest(user, 'Chemistry');

    await user.click(await screen.findByRole('button', { name: /upload a file/i }));
    const file = new File(['%PDF-1.4 fake pdf bytes'], 'guide.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/choose file/i) as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /submit marking guide/i }));

    await waitFor(() => expect(spekoohLib.uploadGuideFile).toHaveBeenCalledWith('instructor-1', 6, file));
    await waitFor(() =>
      expect(spekoohLib.submitMarkingGuideFile).toHaveBeenCalledWith(6, [{ question_type: 'SHORT_ANSWER' }], 'instructor-1/6-123456.pdf')
    );
  });

  it('restores a saved draft when the request is reopened', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([
      makeRequest({
        ...ACCEPTED,
        draft_content: [{ question_type: 'ESSAY', text: 'Discuss osmosis', answer: 'Movement of water across a membrane' }],
        draft_saved_at: hoursFromNow(-1),
      }),
    ]);
    renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: /in progress/i }));
    await openRequest(user, 'Chemistry');

    expect(await screen.findByDisplayValue('Discuss osmosis')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Movement of water across a membrane')).toBeInTheDocument();
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
  });

  describe('draft autosave', () => {
    afterEach(() => vi.useRealTimers());

    it('saves the draft after typing stops, not on every keystroke', async () => {
      vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([ACCEPTED]);
      vi.mocked(spekoohLib.saveGuideDraft).mockResolvedValue(new Date().toISOString());
      const user = userEvent.setup();
      renderWorkspace();
      await user.click(await screen.findByRole('tab', { name: /in progress/i }));
      await openRequest(user, 'Chemistry');
      const answer = await screen.findByPlaceholderText('Expected answer');

      vi.useFakeTimers();
      fireEvent.change(answer, { target: { value: 'H2O' } });
      fireEvent.change(answer, { target: { value: 'H2O is water' } });
      expect(spekoohLib.saveGuideDraft).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS + 50);
      });

      expect(spekoohLib.saveGuideDraft).toHaveBeenCalledTimes(1);
      expect(spekoohLib.saveGuideDraft).toHaveBeenCalledWith(6, [{ question_type: 'SHORT_ANSWER', text: '', answer: 'H2O is water' }]);
      expect(screen.getByText('Draft saved')).toBeInTheDocument();
    });

    it('says so, and keeps the work on screen, when the draft cannot be saved', async () => {
      vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([ACCEPTED]);
      vi.mocked(spekoohLib.saveGuideDraft).mockRejectedValue(new Error('offline'));
      const user = userEvent.setup();
      renderWorkspace();
      await user.click(await screen.findByRole('tab', { name: /in progress/i }));
      await openRequest(user, 'Chemistry');
      const answer = await screen.findByPlaceholderText('Expected answer');

      vi.useFakeTimers();
      fireEvent.change(answer, { target: { value: 'H2O' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS + 50);
      });

      expect(screen.getByText(/could not save your draft/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('H2O')).toBeInTheDocument();
    });

    it('does not write anything when nothing has been edited', async () => {
      vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([ACCEPTED]);
      const user = userEvent.setup();
      renderWorkspace();
      await user.click(await screen.findByRole('tab', { name: /in progress/i }));
      await openRequest(user, 'Chemistry');
      await screen.findByPlaceholderText('Expected answer');

      vi.useFakeTimers();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS * 3);
      });

      expect(spekoohLib.saveGuideDraft).not.toHaveBeenCalled();
    });
  });

  it('shows what was submitted and links to earnings', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([
      makeRequest({
        subject: 'Physics',
        status: 'submitted',
        responded_at: hoursFromNow(-30),
        submitted_at: hoursFromNow(-2),
        content: [{ question_type: 'ESSAY', text: 'Define velocity', answer: 'Rate of change of displacement' }],
      }),
    ]);
    vi.mocked(spekoohLib.fetchEarnings).mockResolvedValue({
      currency: 'XAF',
      total_earned: 0,
      available: 0,
      in_review: 0,
      paid_out: 0,
      ledger: [],
      withdrawals: [],
    });
    renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: /^submitted/i }));
    await openRequest(user, 'Physics');

    expect(await screen.findByText('Rate of change of displacement')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /view earnings/i }));
    expect(await screen.findByText('Your Spekooh earnings')).toBeInTheDocument();
  });
});

describe('SpekoohMarkingRequests earnings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
    vi.mocked(spekoohLib.fetchMyMarkingRequests).mockResolvedValue([]);
  });

  const EARNINGS = {
    currency: 'XAF',
    total_earned: 5000,
    available: 2800,
    in_review: 1200,
    paid_out: 1000,
    ledger: [
      { id: 1, paper_id: 7, subject: 'Biology', paper_status: 'PUBLISHED', amount: 3000, created_at: '2026-09-10T10:00:00Z' },
      { id: 2, paper_id: 8, subject: 'Chemistry', paper_status: 'GUIDE_SUBMITTED', amount: 2000, created_at: '2026-09-12T10:00:00Z' },
    ],
    withdrawals: [
      { id: 1, amount: 1000, status: 'PAID' as const, kyc_status: 'APPROVED', payout_method: 'mtn', created_at: '2026-09-11T10:00:00Z', updated_at: '2026-09-13T10:00:00Z' },
      { id: 2, amount: 500, status: 'PENDING' as const, kyc_status: 'PENDING', payout_method: 'orange', created_at: '2026-09-14T10:00:00Z', updated_at: '2026-09-14T10:00:00Z' },
    ],
  };

  async function openEarnings() {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: /earnings/i }));
  }

  it('shows the balance, credits by paper and payout status', async () => {
    vi.mocked(spekoohLib.fetchEarnings).mockResolvedValue(EARNINGS);
    await openEarnings();

    expect(await screen.findByText('Available')).toBeInTheDocument();
    expect(screen.getByText(/2\s?800 FCFA/)).toBeInTheDocument();
    expect(screen.getByText(/1\s?200 FCFA/)).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText(/Payouts are reviewed and paid by the Spekooh team/)).toBeInTheDocument();
  });

  it('shows empty states for a brand-new instructor', async () => {
    vi.mocked(spekoohLib.fetchEarnings).mockResolvedValue({ ...EARNINGS, total_earned: 0, available: 0, in_review: 0, paid_out: 0, ledger: [], withdrawals: [] });
    await openEarnings();

    expect(await screen.findByText(/Credits appear here once you submit/)).toBeInTheDocument();
    expect(screen.getByText('No payouts requested yet.')).toBeInTheDocument();
  });

  it('offers a retry when earnings cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchEarnings).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(EARNINGS);
    await openEarnings();

    expect(await screen.findByText('Could not load your earnings.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Available')).toBeInTheDocument();
  });
});
