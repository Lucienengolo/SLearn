import { supabase } from './supabase';

// public_profiles (0046_restrict_profile_email.sql) deliberately excludes
// whatsapp_contact -- it's personal contact info, not safe to expose to
// every other user the way full_name/avatar_url/bio are. This RPC
// (0059_profile_whatsapp_contact.sql) is security definer, scoped to
// auth.uid() internally, so it only ever returns the caller's own value.
export async function fetchMyWhatsappContact(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_my_whatsapp_contact');
  if (error) throw error;
  return data;
}
