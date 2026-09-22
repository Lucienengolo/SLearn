import { supabase } from './supabase';
import type { TranslationKey } from './i18n';

// Data layer for the Spekooh↔S@Learn marking-request integration (see
// supabase/functions/spekooh-webhook and spekooh-respond, and Spekooh's own
// apps.instructors app). Reads go straight against spekooh_marking_requests
// (RLS already scopes SELECT to instructor_id = auth.uid()); writes always
// go through spekooh-respond so Spekooh's own state is the source of truth
// and our local row only updates after Spekooh confirms it applied.

export type SpekoohMarkingRequestStatus = 'pending' | 'accepted' | 'rejected' | 'submitted';
export type MarkingGuideQuestionType = 'SHORT_ANSWER' | 'CALCULATION' | 'ESSAY';

export type MarkingGuideQuestion = {
  question_type: MarkingGuideQuestionType;
  text: string;
  answer: string;
};

// File mode's content is only ever this shape server-side too (real
// text/answer omitted) -- Spekooh's credit calculator only ever reads
// question_type off each entry regardless of which form this took.
export type MarkingGuideQuestionTally = { question_type: MarkingGuideQuestionType };

export type SpekoohMarkingRequest = {
  id: string;
  spekooh_request_id: number;
  spekooh_paper_id: number;
  instructor_id: string;
  subject: string | null;
  status: SpekoohMarkingRequestStatus;
  sent_at: string;
  responds_by: string | null;
  guide_deadline: string | null;
  content: MarkingGuideQuestion[] | null;
  paper_file_url: string | null;
  guide_storage_path: string | null;
  // Paper context, from Spekooh's richer new_request push (migration 0063).
  // All nullable: rows from before it, or from a Spekooh that has not
  // deployed it yet, simply show less.
  category: string | null;
  category_title: string | null;
  exam_type: string | null;
  system: string | null;
  track: string | null;
  exam_board: string | null;
  exam_year: number | null;
  language: string | null;
  report_title: string | null;
  report_institution: string | null;
  report_discipline: string | null;
  responded_at: string | null;
  submitted_at: string | null;
  decline_reason: string | null;
  draft_content: MarkingGuideQuestion[] | null;
  draft_saved_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchMyMarkingRequests(instructorId: string): Promise<SpekoohMarkingRequest[]> {
  const { data, error } = await supabase
    .from('spekooh_marking_requests')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching Spekooh marking requests:', error);
    return [];
  }
  return (data ?? []) as SpekoohMarkingRequest[];
}

export const MAX_DECLINE_REASON_LENGTH = 500;

export async function respondToMarkingRequest(
  spekoohRequestId: number,
  decision: 'ACCEPTED' | 'REJECTED',
  reason?: string
): Promise<void> {
  const trimmedReason = reason?.trim();
  const { error } = await supabase.functions.invoke('spekooh-respond', {
    body: {
      spekooh_request_id: spekoohRequestId,
      action: 'respond',
      decision,
      ...(trimmedReason ? { reason: trimmedReason } : {}),
    },
  });
  if (error) throw error;
}

export async function submitMarkingGuide(spekoohRequestId: number, content: MarkingGuideQuestion[]): Promise<void> {
  const { error } = await supabase.functions.invoke('spekooh-respond', {
    body: { spekooh_request_id: spekoohRequestId, action: 'submit_guide', content },
  });
  if (error) throw error;
}

// Private bucket, RLS-scoped to the caller's own folder
// (0062_spekooh_marking_guide_file_upload.sql) -- same pattern as
// lib/instructorApplications.ts's uploadCredential. Returns the storage
// path (not a URL); spekooh-respond signs it server-side right before
// forwarding to Spekooh, so no long-lived signed URL is generated here.
export async function uploadGuideFile(instructorId: string, spekoohRequestId: number, file: File): Promise<string> {
  const extension = file.name.split('.').pop();
  const path = `${instructorId}/${spekoohRequestId}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from('marking-guides').upload(path, file);
  if (error) throw error;

  return path;
}

export async function submitMarkingGuideFile(
  spekoohRequestId: number,
  tally: MarkingGuideQuestionTally[],
  storagePath: string
): Promise<void> {
  const { error } = await supabase.functions.invoke('spekooh-respond', {
    body: { spekooh_request_id: spekoohRequestId, action: 'submit_guide', content: tally, storage_path: storagePath },
  });
  if (error) throw error;
}

// --- Inbox grouping and deadlines ---

// The four places a request can sit in the instructor's inbox. "closed" holds
// both requests the instructor declined and ones nobody answered in time --
// neither needs anything from them any more.
export type InboxBucket = 'needs_response' | 'in_progress' | 'submitted' | 'closed';

export const INBOX_BUCKETS: InboxBucket[] = ['needs_response', 'in_progress', 'submitted', 'closed'];

// A pending request past its response deadline has been (or is about to be)
// routed to the next instructor on Spekooh's side, but our copy only learns
// that when the deadline itself says so -- Spekooh does not push a timeout.
export function isExpired(request: SpekoohMarkingRequest, now: Date): boolean {
  return request.status === 'pending' && request.responds_by !== null && new Date(request.responds_by) <= now;
}

export function bucketFor(request: SpekoohMarkingRequest, now: Date): InboxBucket {
  if (request.status === 'accepted') return 'in_progress';
  if (request.status === 'submitted') return 'submitted';
  if (request.status === 'rejected' || isExpired(request, now)) return 'closed';
  return 'needs_response';
}

export function countByBucket(requests: SpekoohMarkingRequest[], now: Date): Record<InboxBucket, number> {
  const counts: Record<InboxBucket, number> = { needs_response: 0, in_progress: 0, submitted: 0, closed: 0 };
  for (const request of requests) counts[bucketFor(request, now)] += 1;
  return counts;
}

export type TimeLeft = { overdue: boolean; days: number; hours: number; minutes: number; urgent: boolean };

// urgent = under 12 hours to go (or already past): the point where an
// instructor should be nudged rather than merely informed.
const URGENT_WITHIN_MS = 12 * 60 * 60 * 1000;

export function timeLeft(deadlineIso: string, now: Date): TimeLeft {
  const remainingMs = new Date(deadlineIso).getTime() - now.getTime();
  const overdue = remainingMs <= 0;
  const totalMinutes = Math.floor(Math.abs(remainingMs) / 60000);
  return {
    overdue,
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
    urgent: remainingMs <= URGENT_WITHIN_MS,
  };
}

export function formatCountdown(left: TimeLeft, t: (key: TranslationKey) => string): string {
  const d = t('dashboard.marking.countdown.d');
  const h = t('dashboard.marking.countdown.h');
  const m = t('dashboard.marking.countdown.m');
  const amount = left.days > 0 ? `${left.days} ${d} ${left.hours} ${h}` : left.hours > 0 ? `${left.hours} ${h} ${left.minutes} ${m}` : `${left.minutes} ${m}`;
  return `${amount} ${left.overdue ? t('dashboard.marking.countdown.overdue') : t('dashboard.marking.countdown.left')}`;
}

// The date that matters for a request in its current state: when to answer
// while pending, when the guide is due once accepted.
export function activeDeadline(request: SpekoohMarkingRequest): string | null {
  if (request.status === 'pending') return request.responds_by;
  if (request.status === 'accepted') return request.guide_deadline;
  return null;
}

export function paperTitle(request: SpekoohMarkingRequest): string | null {
  return request.report_title || request.subject || request.report_discipline || null;
}

// The facts an instructor weighs before taking a paper, in reading order.
// Blank/missing values are dropped rather than shown as dashes, so an older
// row with no context yields an empty list, not a row of placeholders.
export function paperFacts(request: SpekoohMarkingRequest): string[] {
  const facts = [
    request.exam_type,
    request.exam_year ? String(request.exam_year) : null,
    request.system ? request.system.charAt(0).toUpperCase() + request.system.slice(1) : null,
    request.track,
    request.exam_board,
    request.report_institution,
    request.language ? request.language.toUpperCase() : null,
  ];
  return facts.filter((fact): fact is string => Boolean(fact && fact.trim()));
}

// --- Paper viewing ---

export type PaperLink = {
  url: string;
  expires_in: number;
  file_name: string;
  content_type: string;
  request_status: string;
};

export type PaperLinkResult =
  | { kind: 'ok'; link: PaperLink }
  // Spekooh no longer offers this paper: the request was closed there, timed
  // out, or its file is gone. Not retryable, unlike a network failure.
  | { kind: 'gone' }
  | { kind: 'error' };

// Asks Spekooh for a fresh short-lived link every time. The link stored on
// the row when the request arrived expired long before an instructor opens
// it, so that column is only a fallback for "does a file exist at all".
export async function fetchPaperLink(spekoohRequestId: number): Promise<PaperLinkResult> {
  const { data, error } = await supabase.functions.invoke('spekooh-paper-link', {
    body: { spekooh_request_id: spekoohRequestId },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    return status === 404 || status === 410 ? { kind: 'gone' } : { kind: 'error' };
  }
  return { kind: 'ok', link: data as PaperLink };
}

// --- Draft guide ---

export async function saveGuideDraft(spekoohRequestId: number, content: MarkingGuideQuestion[]): Promise<string> {
  const { data, error } = await supabase.rpc('save_spekooh_marking_draft', {
    p_spekooh_request_id: spekoohRequestId,
    p_content: content,
  });
  if (error) throw error;
  return data as string;
}

// --- Earnings ---

export type SpekoohWithdrawalStatus = 'PENDING' | 'APPROVED' | 'PAID';

export type SpekoohEarnings = {
  currency: string;
  total_earned: number;
  available: number;
  in_review: number;
  paid_out: number;
  ledger: {
    id: number;
    paper_id: number | null;
    subject: string | null;
    paper_status: string | null;
    amount: number;
    created_at: string;
  }[];
  withdrawals: {
    id: number;
    amount: number;
    status: SpekoohWithdrawalStatus;
    kyc_status: string;
    payout_method: string;
    created_at: string;
    updated_at: string;
  }[];
};

// Spekooh owns the ledger and the payouts, so this is always a live read
// through spekooh-earnings -- there is no local copy that could disagree.
export async function fetchEarnings(): Promise<SpekoohEarnings> {
  const { data, error } = await supabase.functions.invoke('spekooh-earnings', { body: {} });
  if (error) throw error;
  return data as SpekoohEarnings;
}

// --- Qualifications ---
// Which of Spekooh's own education-level categories this instructor is
// qualified to mark, pushed to Spekooh so its routing can filter on it
// (2026-09-22 owner report: a paper was routed by subject alone, with no
// qualification check at all). See supabase/functions/spekooh-qualifications.

export type SpekoohCategory = { key: string; title: string };

// Spekooh's own live category list -- never hardcoded here, so the picker
// can't drift out of sync with what Spekooh's routing actually checks.
export async function fetchSpekoohCategories(): Promise<SpekoohCategory[]> {
  const { data, error } = await supabase.functions.invoke('spekooh-qualifications', {
    body: { action: 'list_categories' },
  });
  if (error) throw error;
  return (data as { categories: SpekoohCategory[] }).categories;
}

export async function fetchMyQualifications(instructorId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('spekooh_instructor_qualifications')
    .select('qualified_categories')
    .eq('instructor_id', instructorId)
    .maybeSingle();
  if (error) throw error;
  return (data?.qualified_categories as string[] | undefined) ?? [];
}

// Saves locally on S@Learn's side and pushes the update to Spekooh in the
// same call. A `warning` in the result means the local save succeeded but
// the push to Spekooh didn't -- the instructor's choice isn't lost, but
// Spekooh's own routing won't see it yet until a retry goes through.
export async function saveSpekoohQualifications(qualifiedCategories: string[]): Promise<{ warning?: string }> {
  const { data, error } = await supabase.functions.invoke('spekooh-qualifications', {
    body: { action: 'save', qualified_categories: qualifiedCategories },
  });
  if (error) throw error;
  return data as { warning?: string };
}
