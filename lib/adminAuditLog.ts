import { supabase } from './supabase';

// Read side of the admin action log (0056_admin_capabilities_batch.sql)
// -- every admin-mutating RPC calls log_admin_action(); any admin can
// read the full trail (accountability between admins, not
// principal-only secrecy).
export type AdminActionLogEntry = {
  id: string;
  admin_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: string | null;
  created_at: string;
};

export async function fetchAdminActionLog(): Promise<AdminActionLogEntry[]> {
  const { data, error } = await supabase.rpc('get_admin_action_log');
  if (error) throw error;
  return data ?? [];
}
