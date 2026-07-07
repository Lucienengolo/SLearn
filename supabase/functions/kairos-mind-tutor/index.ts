// Kairos Mind: in-lesson AI tutor (explain / quiz / translate). Never called
// directly from the browser — the client only ever talks to this function,
// which holds ANTHROPIC_API_KEY server-side and rate-limits per user.
//
// Guests don't get tutor access (a deliberate scope decision, not an
// oversight): unmetered access to a paid model API for anonymous traffic is
// a straightforward abuse vector, and gating it behind sign-in is a natural
// nudge toward creating an account.
import Anthropic from '@anthropic-ai/sdk';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';

type TutorMode = 'explain' | 'quiz' | 'translate';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type TutorRequestBody = {
  lessonId: string;
  mode: TutorMode;
  message: string;
  targetLanguage?: string;
  history?: ChatMessage[];
};

const MODES: TutorMode[] = ['explain', 'quiz', 'translate'];

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string';
}

function isTutorRequestBody(value: unknown): value is TutorRequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.lessonId !== 'string' || typeof v.message !== 'string') return false;
  if (!MODES.includes(v.mode as TutorMode)) return false;
  if (v.targetLanguage !== undefined && typeof v.targetLanguage !== 'string') return false;
  if (v.history !== undefined && (!Array.isArray(v.history) || !v.history.every(isChatMessage))) {
    return false;
  }
  return true;
}

// Generous enough for genuine study sessions, tight enough that a scripted
// loop can't run up API cost unattended.
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_REQUESTS = 30;
const MAX_HISTORY_MESSAGES = 20;

const MODE_INSTRUCTIONS: Record<TutorMode, (targetLanguage?: string) => string> = {
  explain: () =>
    "The student wants help understanding this lesson. Answer their question clearly, using the lesson content above as your primary source of truth. If the lesson doesn't cover what they're asking, say so honestly rather than inventing information.",
  quiz: () =>
    "Quiz the student on this lesson's material. If their message is empty or asks you to start, generate one multiple-choice or short-answer question based on the lesson content and wait for their answer. If their message is an answer to a question you already asked, grade it, explain the correct answer, and then offer another question.",
  translate: (targetLanguage) =>
    `Translate the student's message (or the lesson content, if they ask for that instead) into ${targetLanguage || 'French'}. Preserve technical terms accurately.`,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Sign in to ask Kairos Mind' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isTutorRequestBody(body)) {
    return json({ error: 'Expected { lessonId, mode, message, targetLanguage?, history? }' }, 400);
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return json({ error: 'Kairos Mind is not configured on this deployment' }, 500);
  }

  const admin = createAdminClient();
  const caller = createCallerClient(authHeader);

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }
  const userId = userData.user.id;

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count, error: countError } = await admin
    .from('ai_tutor_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart);

  if (countError) {
    return json({ error: `Failed to check rate limit: ${countError.message}` }, 500);
  }
  if ((count ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
    return json(
      { error: `You've reached the limit of ${RATE_LIMIT_MAX_REQUESTS} tutor messages per hour. Try again later.` },
      429
    );
  }

  // Fetched with the CALLER's own JWT, not the admin client — this is what
  // makes it a real access check rather than a formality. RLS on `lessons`
  // (0001_core_schema.sql) only allows a row through for free published
  // courses, the enrolled student, or the owning instructor. If the
  // student hasn't paid for this course, this query returns nothing and we
  // 403 — Kairos Mind can't become a backdoor to paid lesson content.
  const { data: lesson, error: lessonError } = await caller
    .from('lessons')
    .select('title, description, content')
    .eq('id', body.lessonId)
    .maybeSingle();

  if (lessonError) {
    return json({ error: `Failed to load lesson: ${lessonError.message}` }, 500);
  }
  if (!lesson) {
    return json({ error: "You don't have access to this lesson" }, 403);
  }

  await admin.from('ai_tutor_requests').insert({
    user_id: userId,
    lesson_id: body.lessonId,
    mode: body.mode,
  });

  const history = (body.history ?? []).slice(-MAX_HISTORY_MESSAGES);

  const systemPrompt = `You are Kairos Mind, an in-lesson AI tutor for S@Learn, an online learning platform. You're helping a student currently viewing this lesson:

Title: ${lesson.title}
Description: ${lesson.description ?? '(none)'}
Content:
"""
${lesson.content ?? '(no text content for this lesson)'}
"""

${MODE_INSTRUCTIONS[body.mode](body.targetLanguage)}

Keep responses focused on this lesson. If the student asks something unrelated to the lesson or the course, gently redirect them back to the material. Keep explanations clear and appropriately brief for a chat interface.`;

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 2048,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          system: systemPrompt,
          messages: [...history, { role: 'user', content: body.message }],
        });

        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event.delta.text)}\n\n`));
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Kairos Mind ran into an error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(`[ERROR] ${message}`)}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
