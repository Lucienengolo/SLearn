// Founder-given admin WhatsApp contact (2026-08-04), hardcoded per
// founder's explicit choice -- unlike VITE_CAL_BOOKING_LINK/PAYMENTS_ENABLED,
// this isn't gated behind an env var/kill-switch; there is exactly one
// admin number and it isn't expected to change per-environment.
//
// Used once a tutor match reaches mutual agreement (status='messaging' +
// confirmed_session_date) while PAYMENTS_ENABLED=false (see
// PaymentStatus.tsx): both parties are handed off here to finalize payment
// out-of-band instead of hitting the disabled Stripe checkout.
export const ADMIN_WHATSAPP_NUMBER = '+237659802679';

// Same wa.me construction as whatsappLink() in lib/matches.ts, with a
// prefilled message so the admin has context immediately instead of an
// unexplained "hi".
export function adminWhatsappLink(context: string): string {
  const digitsOnly = ADMIN_WHATSAPP_NUMBER.replace(/[^\d]/g, '');
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(context)}`;
}
