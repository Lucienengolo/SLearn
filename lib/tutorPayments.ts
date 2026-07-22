import { supabase, TutorSessionPayment } from './supabase';

export async function fetchPaymentForMatch(matchId: string): Promise<TutorSessionPayment | null> {
  const { data, error } = await supabase.from('tutor_session_payments').select('*').eq('match_id', matchId).maybeSingle();
  if (error) throw error;
  return data;
}

// Redirects to Stripe Checkout for the 20%-of-rate deposit
// (create-tutor-deposit-checkout computes the actual amount server-side --
// never trust a client-supplied amount for a payment).
export async function createDepositCheckout(matchId: string, origin: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('create-tutor-deposit-checkout', {
    body: { matchId, origin },
  });
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error ?? 'Stripe did not return a checkout URL');
  return data.url;
}

// Idempotent server-side (confirm_balance_received RPC) -- safe to call
// again if a tutor double-taps the button.
export async function confirmBalanceReceived(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_balance_received', { p_match_id: matchId });
  if (error) throw error;
}

export type CancelBookingResult = { path: 'cancelled_refunded' | 'dispute_review' };

export async function cancelBooking(matchId: string): Promise<CancelBookingResult> {
  const { data, error } = await supabase.functions.invoke<CancelBookingResult>('cancel-tutor-booking', {
    body: { matchId },
  });
  if (error) throw error;
  if (!data) throw new Error('No response from cancellation');
  return data;
}
