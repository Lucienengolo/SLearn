import { createHmac } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { callPartner, partnerApiUrl, signPayload } from '../supabase/functions/_shared/spekoohPartner';

describe('signPayload', () => {
  it('matches the HMAC-SHA256 of "<timestamp>.<body>" that Spekooh verifies', async () => {
    const expected = 'sha256=' + createHmac('sha256', 'shared-secret').update('1700000000.{"a":1}').digest('hex');
    expect(await signPayload('1700000000', '{"a":1}', 'shared-secret')).toBe(expected);
  });

  it('changes when the body or the secret changes', async () => {
    const base = await signPayload('1', '{"instructor_id":"a"}', 's');
    expect(await signPayload('1', '{"instructor_id":"b"}', 's')).not.toBe(base);
    expect(await signPayload('1', '{"instructor_id":"a"}', 'other')).not.toBe(base);
  });
});

describe('partnerApiUrl', () => {
  it('derives the pull endpoints from the configured webhook URL', () => {
    expect(partnerApiUrl('https://spekooh.example/api/instructors/webhook/', 'paper-link')).toBe(
      'https://spekooh.example/api/instructors/partner/paper-link/'
    );
    expect(partnerApiUrl('https://spekooh.example/api/instructors/webhook', 'earnings')).toBe(
      'https://spekooh.example/api/instructors/partner/earnings/'
    );
  });

  it('refuses a URL that is not the webhook, rather than signing a call to the wrong place', () => {
    expect(partnerApiUrl(undefined, 'earnings')).toBeNull();
    expect(partnerApiUrl('', 'earnings')).toBeNull();
    expect(partnerApiUrl('https://spekooh.example/somewhere/else', 'earnings')).toBeNull();
  });
});

describe('callPartner', () => {
  it('posts the payload with a signature Spekooh can verify, and returns its status and body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'https://x' }), { status: 200 }));

    const result = await callPartner({
      url: 'https://spekooh.example/api/instructors/partner/paper-link/',
      partnerId: 's-learn',
      secret: 'shared-secret',
      payload: { instructor_request_id: 5, instructor_id: 'abc' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ status: 200, body: { url: 'https://x' } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://spekooh.example/api/instructors/partner/paper-link/');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"instructor_request_id":5,"instructor_id":"abc"}');
    expect(init.headers['X-Spekooh-Partner-Id']).toBe('s-learn');
    const timestamp = init.headers['X-Spekooh-Timestamp'];
    expect(init.headers['X-Spekooh-Signature']).toBe(
      'sha256=' + createHmac('sha256', 'shared-secret').update(`${timestamp}.${init.body}`).digest('hex')
    );
  });

  it('passes a non-200 status through instead of throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'gone' }), { status: 410 }));
    const result = await callPartner({
      url: 'https://x/',
      partnerId: 'p',
      secret: 's',
      payload: {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ status: 410, body: { detail: 'gone' } });
  });

  it('survives a non-JSON response body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>oops</html>', { status: 502 }));
    const result = await callPartner({ url: 'https://x/', partnerId: 'p', secret: 's', payload: {}, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ status: 502, body: {} });
  });
});
