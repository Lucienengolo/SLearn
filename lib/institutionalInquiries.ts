import { supabase, InstitutionalAccountType, InstitutionalInquiry } from './supabase';

export type SubmitInstitutionalInquiryInput = {
  accountType: InstitutionalAccountType;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  message: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidContactEmail(raw: string): boolean {
  return EMAIL_PATTERN.test(raw.trim());
}

// Public lead-capture insert (0035_institutional_inquiries.sql) -- no login
// required, same trust level as a marketing contact form. Not a substitute
// for an actual account type; see TODOS.md for why school/business/
// government stay marketing-only tracks for now.
export async function submitInstitutionalInquiry(
  input: SubmitInstitutionalInquiryInput
): Promise<InstitutionalInquiry> {
  const organizationName = input.organizationName.trim();
  const contactName = input.contactName.trim();
  const contactEmail = input.contactEmail.trim();

  if (!organizationName || !contactName || !contactEmail) {
    throw new Error('Organization name, contact name, and email are required.');
  }
  if (!isValidContactEmail(contactEmail)) {
    throw new Error('Enter a valid email address.');
  }

  const { data, error } = await supabase
    .from('institutional_inquiries')
    .insert({
      account_type: input.accountType,
      organization_name: organizationName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: input.contactPhone?.trim() || null,
      message: input.message?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as InstitutionalInquiry;
}
