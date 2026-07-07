// Client for the kairos-mind-tutor edge function. Never calls the model API
// directly — this only ever talks to our own function, which holds
// ANTHROPIC_API_KEY server-side.
import { supabase } from './supabase';

export type KairosMindMode = 'explain' | 'quiz' | 'translate';

export type KairosMindMessage = { role: 'user' | 'assistant'; content: string };

export async function streamKairosMindReply(
  params: {
    lessonId: string;
    mode: KairosMindMode;
    message: string;
    targetLanguage?: string;
    history: KairosMindMessage[];
  },
  onToken: (token: string) => void
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Sign in to ask Kairos Mind.');
  }

  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kairos-mind-tutor`;

  const response = await fetch(functionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Kairos Mind request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const match = event.match(/^data: (.*)$/s);
      if (!match) continue;

      const raw = match[1];
      if (raw === '[DONE]') return;

      const text = JSON.parse(raw) as string;
      if (text.startsWith('[ERROR] ')) {
        throw new Error(text.slice('[ERROR] '.length));
      }
      onToken(text);
    }
  }
}
