-- Address field for instructor applications, needed as the basis for the
-- KYC document cross-check (0018): Claude Vision reads the uploaded ID
-- document and compares its visible name/address against what the
-- applicant typed here, surfacing a match/mismatch signal rather than
-- trusting either source blindly.
alter table instructor_applications
  add column if not exists address text;
