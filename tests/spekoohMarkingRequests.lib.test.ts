import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';
import {
  SpekoohMarkingRequest,
  activeDeadline,
  bucketFor,
  countByBucket,
  fetchPaperLink,
  isExpired,
  paperFacts,
  paperTitle,
  respondToMarkingRequest,
  saveGuideDraft,
  timeLeft,
} from '../lib/spekoohMarkingRequests';

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn(), from: vi.fn(), storage: { from: vi.fn() } },
}));

const NOW = new Date('2026-09-21T12:00:00Z');
const at = (hours: number) => new Date(NOW.getTime() + hours * 3600_000).toISOString();

function req(overrides: Partial<SpekoohMarkingRequest> = {}): SpekoohMarkingRequest {
  return {
    id: 'r',
    spekooh_request_id: 1,
    spekooh_paper_id: 1,
    instructor_id: 'i',
    subject: 'Biology',
    status: 'pending',
    sent_at: at(-1),
    responds_by: at(24),
    guide_deadline: null,
    content: null,
    paper_file_url: null,
    guide_storage_path: null,
    category: null,
    category_title: null,
    exam_type: null,
    system: null,
    track: null,
    exam_board: null,
    exam_year: null,
    language: null,
    report_title: null,
    report_institution: null,
    report_discipline: null,
    responded_at: null,
    submitted_at: null,
    decline_reason: null,
    draft_content: null,
    draft_saved_at: null,
    created_at: at(-1),
    updated_at: at(-1),
    ...overrides,
  };
}

describe('inbox buckets', () => {
  it('puts each status in its bucket', () => {
    expect(bucketFor(req(), NOW)).toBe('needs_response');
    expect(bucketFor(req({ status: 'accepted' }), NOW)).toBe('in_progress');
    expect(bucketFor(req({ status: 'submitted' }), NOW)).toBe('submitted');
    expect(bucketFor(req({ status: 'rejected' }), NOW)).toBe('closed');
  });

  it('treats a pending request past its deadline as closed, not still waiting', () => {
    const expired = req({ responds_by: at(-0.01) });
    expect(isExpired(expired, NOW)).toBe(true);
    expect(bucketFor(expired, NOW)).toBe('closed');
  });

  it('never calls an accepted request expired, however old its response deadline', () => {
    expect(isExpired(req({ status: 'accepted', responds_by: at(-100) }), NOW)).toBe(false);
  });

  it('counts every request exactly once', () => {
    const counts = countByBucket(
      [req(), req(), req({ status: 'accepted' }), req({ status: 'rejected' }), req({ responds_by: at(-5) })],
      NOW
    );
    expect(counts).toEqual({ needs_response: 2, in_progress: 1, submitted: 0, closed: 2 });
  });
});

describe('timeLeft', () => {
  it('breaks a deadline into days, hours and minutes', () => {
    const left = timeLeft(at(2 * 24 + 3 + 0.5), NOW);
    expect(left).toMatchObject({ overdue: false, days: 2, hours: 3, minutes: 30, urgent: false });
  });

  it('is urgent inside 12 hours and not before', () => {
    expect(timeLeft(at(11.9), NOW).urgent).toBe(true);
    expect(timeLeft(at(12.1), NOW).urgent).toBe(false);
  });

  it('reports how long ago a passed deadline was', () => {
    expect(timeLeft(at(-26), NOW)).toMatchObject({ overdue: true, urgent: true, days: 1, hours: 2 });
  });
});

describe('activeDeadline', () => {
  it('is the response deadline while pending and the guide deadline once accepted', () => {
    expect(activeDeadline(req({ responds_by: 'A' }))).toBe('A');
    expect(activeDeadline(req({ status: 'accepted', responds_by: 'A', guide_deadline: 'B' }))).toBe('B');
  });

  it('is nothing once the request is finished with', () => {
    expect(activeDeadline(req({ status: 'submitted', guide_deadline: 'B' }))).toBeNull();
    expect(activeDeadline(req({ status: 'rejected' }))).toBeNull();
  });
});

describe('paperFacts and paperTitle', () => {
  it('lists the context in reading order and drops what is missing', () => {
    const facts = paperFacts(req({ exam_type: 'O Level', exam_year: 2022, system: 'anglophone', track: '', exam_board: 'GCE Board', language: 'en' }));
    expect(facts).toEqual(['O Level', '2022', 'Anglophone', 'GCE Board', 'EN']);
  });

  it('yields nothing for an older row with no context', () => {
    expect(paperFacts(req())).toEqual([]);
  });

  it('titles a report by its own title, and an exam paper by its subject', () => {
    expect(paperTitle(req({ report_title: 'Inventory System Design' }))).toBe('Inventory System Design');
    expect(paperTitle(req())).toBe('Biology');
    expect(paperTitle(req({ subject: null, report_discipline: 'Software Engineering' }))).toBe('Software Engineering');
    expect(paperTitle(req({ subject: null }))).toBeNull();
  });
});

describe('supabase calls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetchPaperLink returns the link Spekooh gave', async () => {
    const link = { url: 'https://x/p.pdf', expires_in: 900, file_name: 'p.pdf', content_type: 'application/pdf', request_status: 'PENDING' };
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: link, error: null });

    expect(await fetchPaperLink(5)).toEqual({ kind: 'ok', link });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('spekooh-paper-link', { body: { spekooh_request_id: 5 } });
  });

  it.each([404, 410])('fetchPaperLink treats a %s as gone, which retrying will not fix', async (status) => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: { context: { status } } as never });
    expect(await fetchPaperLink(5)).toEqual({ kind: 'gone' });
  });

  it('fetchPaperLink treats any other failure as a retryable error', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: { context: { status: 502 } } as never });
    expect(await fetchPaperLink(5)).toEqual({ kind: 'error' });
  });

  it('respondToMarkingRequest sends a trimmed reason, and none when it is blank', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: {}, error: null });

    await respondToMarkingRequest(5, 'REJECTED', '  no time  ');
    expect(supabase.functions.invoke).toHaveBeenLastCalledWith('spekooh-respond', {
      body: { spekooh_request_id: 5, action: 'respond', decision: 'REJECTED', reason: 'no time' },
    });

    await respondToMarkingRequest(5, 'REJECTED', '   ');
    expect(supabase.functions.invoke).toHaveBeenLastCalledWith('spekooh-respond', {
      body: { spekooh_request_id: 5, action: 'respond', decision: 'REJECTED' },
    });
  });

  it('saveGuideDraft goes through the narrow draft function and returns when it saved', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: '2026-09-21T12:00:00Z', error: null } as never);
    const saved = await saveGuideDraft(5, [{ question_type: 'ESSAY', text: 'q', answer: 'a' }]);
    expect(saved).toBe('2026-09-21T12:00:00Z');
    expect(supabase.rpc).toHaveBeenCalledWith('save_spekooh_marking_draft', {
      p_spekooh_request_id: 5,
      p_content: [{ question_type: 'ESSAY', text: 'q', answer: 'a' }],
    });
  });

  it('saveGuideDraft throws when the save is refused', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'No open marking request' } } as never);
    await expect(saveGuideDraft(5, [])).rejects.toBeTruthy();
  });
});
