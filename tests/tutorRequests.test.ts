import { describe, it, expect } from 'vitest';
import { isValidWhatsappContact } from '../lib/tutorRequests';

describe('isValidWhatsappContact', () => {
  it('accepts a well-formed Cameroon mobile number with spaces', () => {
    expect(isValidWhatsappContact('+237 650 123 456')).toBe(true);
  });

  it('accepts the same number with no spaces', () => {
    expect(isValidWhatsappContact('+237650123456')).toBe(true);
  });

  it('rejects a number missing the country code', () => {
    expect(isValidWhatsappContact('650123456')).toBe(false);
  });

  it('rejects a number that does not start with 6', () => {
    expect(isValidWhatsappContact('+237750123456')).toBe(false);
  });

  it('rejects a number with the wrong digit count', () => {
    expect(isValidWhatsappContact('+23765012345')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidWhatsappContact('')).toBe(false);
  });
});
