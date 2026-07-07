// Provider-agnostic email sender. Uses Resend's HTTP API — swap the fetch
// call below if you'd rather use SendGrid/Postmark/SES; nothing else in
// these functions depends on the provider.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('NOTIFICATIONS_FROM_EMAIL') ?? 'S@Learn <notifications@slearn.app>';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send email (${response.status}): ${body}`);
  }
}

const wrap = (title: string, body: string) => `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #157A4D;">${title}</h2>
    ${body}
    <p style="color: #767C72; font-size: 12px; margin-top: 32px;">S@Learn Instructor Verification</p>
  </div>
`;

export const emailTemplates = {
  applicationSubmitted: (fullName: string) =>
    wrap(
      "We've got your application",
      `<p>Hi ${fullName},</p>
       <p>Thanks for applying to teach on S@Learn. Our team will review your qualifications and credentials, then follow up about scheduling your interview.</p>`
    ),
  interviewScheduled: (fullName: string, scheduledAt: string) =>
    wrap(
      'Your interview is scheduled',
      `<p>Hi ${fullName},</p>
       <p>Your instructor verification interview is scheduled for <strong>${new Date(scheduledAt).toLocaleString()}</strong>. We'll send a reminder beforehand.</p>`
    ),
  approved: (fullName: string) =>
    wrap(
      "You're verified — welcome to teaching!",
      `<p>Hi ${fullName},</p>
       <p>Congratulations — your instructor application has been approved. Your studio is now unlocked; sign back in to start building your first course.</p>`
    ),
  rejected: (fullName: string, notes?: string) =>
    wrap(
      'An update on your instructor application',
      `<p>Hi ${fullName},</p>
       <p>Thanks for your interest in teaching on S@Learn. We're not able to move forward with your application at this time.</p>
       ${notes ? `<p><em>${notes}</em></p>` : ''}`
    ),
};
