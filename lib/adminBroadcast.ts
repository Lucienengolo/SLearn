import { supabase } from './supabase';

export type BroadcastAudience = 'all' | 'students' | 'instructors';

// Admin-only: one notifications row per matching profile
// (0056_admin_capabilities_batch.sql) -- distinct from notifyInstructor's
// single-recipient warning.
export async function broadcastAnnouncement(audience: BroadcastAudience, title: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('broadcast_announcement', { p_audience: audience, p_title: title, p_body: body });
  if (error) throw error;
}
