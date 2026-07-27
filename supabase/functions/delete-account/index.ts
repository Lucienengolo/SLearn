// Self-service account deletion (Pathfinder profile page reference,
// 2026-07-27). Always deletes the CALLER's own account -- there is no
// target-user parameter, so this endpoint can never be used to delete
// someone else's account. profiles.id has `references auth.users(id) on
// delete cascade` (0001_core_schema.sql), so deleting the auth.users row
// cascades through profiles to everything owned by that profile
// (enrollments, courses, tutor requests, etc.) without needing a manual
// cleanup pass here.
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const caller = createCallerClient(authHeader);
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);

  if (deleteError) {
    return json({ error: `Failed to delete account: ${deleteError.message}` }, 500);
  }

  return json({ deleted: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
