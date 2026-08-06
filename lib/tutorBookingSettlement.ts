import { supabase } from './supabase';

// Reviewer-only "minimal settle action" (founder decision, 2026-08-04):
// once a match is mutually agreed (messaging + confirmed_session_date) and
// the admin has finalized payment with both parties on WhatsApp (see
// lib/adminContact.ts), a reviewer marks it settled here instead of
// requiring direct DB access. Backed by get_pending_match_settlements()/
// settle_match_manually() (0051_tutor_match_manual_settlement.sql), both
// security-definer and self-verifying is_reviewer server-side.
export type PendingMatchSettlement = {
  match_id: string;
  confirmed_session_date: string;
  parent_name: string | null;
  parent_whatsapp: string;
  tutor_name: string | null;
  tutor_whatsapp: string;
  budget_min: number | null;
  budget_max: number | null;
  budget_period: 'weekly' | 'monthly' | null;
  sessions_per_week: number;
};

export async function fetchPendingSettlements(): Promise<PendingMatchSettlement[]> {
  const { data, error } = await supabase.rpc('get_pending_match_settlements');
  if (error) throw error;
  return data ?? [];
}

export async function settleMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('settle_match_manually', { p_match_id: matchId });
  if (error) throw error;
}

// Tutor self-service close-out (founder feedback, 2026-08-05): the tutor
// confirms payment was finalized with the admin on WhatsApp and this
// closes the booking directly -- no reviewer step needed for the normal
// case. Idempotent server-side (confirm_manual_payment_received RPC,
// 0052_tutor_confirms_manual_payment.sql) -- safe to call again if a
// tutor double-taps the button.
export async function confirmManualPaymentReceived(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_manual_payment_received', { p_match_id: matchId });
  if (error) throw error;
}
