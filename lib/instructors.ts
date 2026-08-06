import { supabase } from './supabase';

// Admin-only instructor directory + management (founder request,
// 2026-08-05, prompted by the "app shows 3 instructors" report -- there
// was no way to see/manage already-approved instructors, only the
// pre-approval application pipeline in lib/instructorApplications.ts).
// Backed by security-definer RPCs (0054_admin_role.sql), each
// self-verifying caller is_admin server-side.
export type InstructorListItem = {
  id: string;
  email: string;
  full_name: string | null;
  verified: boolean;
  created_at: string;
};

export async function fetchAllInstructors(): Promise<InstructorListItem[]> {
  const { data, error } = await supabase.rpc('get_all_instructors');
  if (error) throw error;
  return data ?? [];
}

// Reversible: only toggles verified, never deletes anything -- see
// 0054_admin_role.sql's comment on why role is never touched.
export async function deactivateInstructor(instructorId: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_instructor', { p_instructor_id: instructorId });
  if (error) throw error;
}

export async function reactivateInstructor(instructorId: string): Promise<void> {
  const { error } = await supabase.rpc('reactivate_instructor', { p_instructor_id: instructorId });
  if (error) throw error;
}

// Principal-admin-only (storefix237@gmail.com) -- set_admin_access itself
// re-verifies this server-side regardless of what the client believes.
export async function setAdminAccess(targetEmail: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_admin_access', { p_target_email: targetEmail, p_is_admin: isAdmin });
  if (error) throw error;
}

// Admin capabilities batch, 2026-08-06 (0056_admin_capabilities_batch.sql):
// notify/warn an instructor and keep private notes on them, so a
// deactivation isn't the first and only signal they ever get.
export async function notifyInstructor(instructorId: string, title: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('notify_instructor', { p_instructor_id: instructorId, p_title: title, p_body: body });
  if (error) throw error;
}

export type InstructorAdminNote = {
  id: string;
  instructor_id: string;
  admin_id: string;
  note: string;
  created_at: string;
};

// instructor_admin_notes has no dedicated RPC -- it's gated by a direct
// is_admin-scoped RLS policy (simple enough not to need one, same
// reasoning as 0004_reviewer_and_notifications.sql's is_reviewer policies).
export async function fetchInstructorNotes(instructorId: string): Promise<InstructorAdminNote[]> {
  const { data, error } = await supabase
    .from('instructor_admin_notes')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addInstructorNote(instructorId: string, adminId: string, note: string): Promise<void> {
  const { error } = await supabase.from('instructor_admin_notes').insert({ instructor_id: instructorId, admin_id: adminId, note });
  if (error) throw error;
}
