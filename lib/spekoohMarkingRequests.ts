import { supabase } from './supabase';

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

export async function respondToMarkingRequest(spekoohRequestId: number, decision: 'ACCEPTED' | 'REJECTED'): Promise<void> {
  const { error } = await supabase.functions.invoke('spekooh-respond', {
    body: { spekooh_request_id: spekoohRequestId, action: 'respond', decision },
  });
  if (error) throw error;
}

export async function submitMarkingGuide(spekoohRequestId: number, content: MarkingGuideQuestion[]): Promise<void> {
  const { error } = await supabase.functions.invoke('spekooh-respond', {
    body: { spekooh_request_id: spekoohRequestId, action: 'submit_guide', content },
  });
  if (error) throw error;
}
