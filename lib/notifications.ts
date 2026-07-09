import { supabase, Notification } from './supabase';

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
}

// Client-side inserts only ever target the caller's own user_id (RLS
// backs this up regardless) -- e.g. LessonViewer notifying a student
// their own certificate was just earned. Cross-user notifications (like
// an instructor application decision) are inserted server-side instead,
// in the instructor-approval edge function, which uses the service role.
export async function notifySelf(userId: string, title: string, body?: string, link?: string): Promise<void> {
  await supabase.from('notifications').insert({ user_id: userId, title, body: body ?? null, link: link ?? null });
}
