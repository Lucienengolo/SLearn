// Public health-check for uptime monitors (UptimeRobot, Better Uptime,
// Checkly, ...). No auth required — point the monitor at
// https://<project-ref>.functions.supabase.co/health and alert on non-200
// or on `status !== "ok"`.
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const admin = createAdminClient();
    // Cheapest possible real query — confirms the DB is reachable and the
    // service-role key is valid, without touching user data.
    const { error } = await admin.from('categories').select('id', { count: 'exact', head: true });

    if (error) {
      return json(
        {
          status: 'error',
          db: 'error',
          message: error.message,
          latency_ms: Date.now() - startedAt,
        },
        503
      );
    }

    return json({
      status: 'ok',
      db: 'ok',
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return json(
      {
        status: 'error',
        db: 'unreachable',
        message: err instanceof Error ? err.message : 'Unknown error',
        latency_ms: Date.now() - startedAt,
      },
      503
    );
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
