// Pure helpers for calling Spekooh's signed partner API (the same HMAC
// channel spekooh-respond uses for accept/reject/submit). Kept free of Deno
// globals other than WebCrypto so vitest can exercise it directly, same as
// cancel-tutor-booking/cancellation.ts.

export async function signPayload(timestamp: string, rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

// SPEKOOH_WEBHOOK_URL is Spekooh's inbound webhook, e.g.
// https://spekooh.example/api/instructors/webhook/. The partner pull
// endpoints live next to it under .../api/instructors/partner/, so derive
// them from that one setting rather than asking for a second secret-adjacent
// env var that could drift out of step with it. Returns null when the URL is
// not the shape we expect, so a misconfiguration fails loudly instead of
// signing a request to the wrong place.
export function partnerApiUrl(webhookUrl: string | undefined, path: 'paper-link' | 'earnings' | 'categories'): string | null {
  if (!webhookUrl) return null;
  const match = webhookUrl.trim().match(/^(https?:\/\/.+\/api\/instructors)\/webhook\/?$/);
  return match ? `${match[1]}/partner/${path}/` : null;
}

export type PartnerCallResult = { status: number; body: unknown };

export async function callPartner(options: {
  url: string;
  partnerId: string;
  secret: string;
  payload: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<PartnerCallResult> {
  const rawBody = JSON.stringify(options.payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signPayload(timestamp, rawBody, options.secret);
  const response = await (options.fetchImpl ?? fetch)(options.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Spekooh-Partner-Id': options.partnerId,
      'X-Spekooh-Timestamp': timestamp,
      'X-Spekooh-Signature': signature,
    },
    body: rawBody,
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}
