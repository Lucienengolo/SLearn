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
