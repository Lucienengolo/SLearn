-- KYC document verification (inspired by fortnight-space's document+selfie
-- capture concept, adapted to this stack -- see verify-identity-document
-- edge function for why this is Claude-vision-assisted extraction +
-- cross-check rather than the original's local ArcFace face-matching,
-- which can't run in a Deno edge function or a browser).
--
-- 'selfie' is a new credential type alongside the existing government_id
-- upload -- the guided capture flow uploads both. No automated face
-- match between the two; a human reviewer judges that visually, per the
-- product decision to keep verification human-in-the-loop.
alter type instructor_credential_type add value if not exists 'selfie';

-- Verification result columns, populated by verify-identity-document
-- against the government_id row specifically. Nullable/unset until a
-- check actually runs; this is advisory data for the applicant checklist
-- and a future reviewer console, never an automated accept/reject.
alter table instructor_credentials
  add column if not exists verification_extracted_name text,
  add column if not exists verification_extracted_address text,
  add column if not exists verification_name_match boolean,
  add column if not exists verification_address_match boolean,
  add column if not exists verification_notes text,
  add column if not exists verification_checked_at timestamptz;
