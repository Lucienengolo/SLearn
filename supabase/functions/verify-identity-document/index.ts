// Reads the applicant's uploaded government ID with Claude Vision and
// cross-checks the name/address it can see against what the applicant
// typed on their application. This is NOT an automated accept/reject —
// it's an advisory signal shown on the applicant's checklist (and, later,
// a reviewer console); a human still makes the actual verification call.
//
// Inspired by fortnight-space's KYC flow (document upload -> extraction ->
// verdict) but adapted to this stack: that project runs InsightFace
// (biometric face-matching) and TrOCR (OCR) as local ML models via
// Streamlit/PyTorch, which can't run in a Deno edge function or a
// browser. Claude Vision replaces the OCR/extraction step; there's no
// biometric face-match here — reviewers compare the selfie to the ID
// visually instead (see IdentityCapture.tsx).
import Anthropic from '@anthropic-ai/sdk';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';

type RequestBody = { applicationId: string };

function isRequestBody(value: unknown): value is RequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.applicationId === 'string';
}

type ExtractionResult = {
  extracted_name: string | null;
  extracted_address: string | null;
  name_match: boolean | null;
  address_match: boolean | null;
  notes: string | null;
};

const EXT_TO_MEDIA_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
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
    return json({ error: 'Sign in required' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isRequestBody(body)) {
    return json({ error: 'Expected { applicationId }' }, 400);
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return json({ error: 'Document verification is not configured on this deployment' }, 500);
  }

  const caller = createCallerClient(authHeader);
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // Fetched with the caller's own JWT: RLS ("applicants view their own
  // application") already guarantees this is the caller's own
  // application, not an admin-client shortcut around that check.
  const { data: application, error: applicationError } = await caller
    .from('instructor_applications')
    .select('id, full_name, address')
    .eq('id', body.applicationId)
    .maybeSingle();

  if (applicationError || !application) {
    return json({ error: 'Application not found' }, 404);
  }

  const admin = createAdminClient();

  const { data: credential, error: credentialError } = await admin
    .from('instructor_credentials')
    .select('id, storage_path')
    .eq('application_id', application.id)
    .eq('credential_type', 'government_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (credentialError || !credential) {
    return json({ error: 'No government ID uploaded yet' }, 404);
  }

  const { data: fileBlob, error: downloadError } = await admin.storage
    .from('instructor-credentials')
    .download(credential.storage_path);

  if (downloadError || !fileBlob) {
    return json({ error: `Could not read uploaded document: ${downloadError?.message ?? 'unknown error'}` }, 500);
  }

  const extension = credential.storage_path.split('.').pop()?.toLowerCase() ?? '';
  const mediaType = EXT_TO_MEDIA_TYPE[extension];
  if (!mediaType) {
    return json({ error: 'Unsupported document file type for automated verification' }, 400);
  }

  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const prompt = `This is a photo of a government-issued identity document (national ID, passport, or driver's license) uploaded during an instructor verification application.

The applicant typed the following on their application:
- Full name: ${application.full_name || '(not provided)'}
- Address: ${application.address || '(not provided)'}

Look at the document image and respond with ONLY a JSON object (no other text, no markdown fences), with exactly these fields:
{
  "extracted_name": string or null (the full name as it appears on the document, or null if no name is legible),
  "extracted_address": string or null (the address as it appears on the document, or null if no address is legible or the document type doesn't carry one),
  "name_match": boolean or null (true if the document's name reasonably matches the applicant's typed name, allowing for minor formatting/order/abbreviation differences; false if they clearly differ; null if extracted_name is null),
  "address_match": boolean or null (same logic as name_match, for address; null if extracted_address is null),
  "notes": string or null (one short sentence flagging anything a human reviewer should look at, e.g. image quality, a partial match, or null if nothing notable)
}`;

  let result: ExtractionResult;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Model did not return JSON');
    result = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: `Document verification failed: ${message}` }, 500);
  }

  const { error: updateError } = await admin
    .from('instructor_credentials')
    .update({
      verification_extracted_name: result.extracted_name,
      verification_extracted_address: result.extracted_address,
      verification_name_match: result.name_match,
      verification_address_match: result.address_match,
      verification_notes: result.notes,
      verification_checked_at: new Date().toISOString(),
    })
    .eq('id', credential.id);

  if (updateError) {
    return json({ error: `Failed to save verification result: ${updateError.message}` }, 500);
  }

  return json(result);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
