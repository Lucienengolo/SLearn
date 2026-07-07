import { createClient } from '@supabase/supabase-js';

// Service-role client: bypasses RLS and is the only caller our
// profiles_set_updated_at trigger (0001/0004 migrations) allows to change
// role/verified/is_reviewer. Never expose SUPABASE_SERVICE_ROLE_KEY to a
// client — it only exists in this function's environment.
export function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Anon-key client bound to the caller's own JWT, used only to identify who
// is calling (auth.getUser) — never for privileged writes.
export function createCallerClient(authHeader: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
