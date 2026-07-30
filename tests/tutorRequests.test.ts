import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidWhatsappContact, googleMapsLinkFor, updateTutorRequest, cancelTutorRequest } from '../lib/tutorRequests';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

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

describe('googleMapsLinkFor', () => {
  it('builds a Google Maps link when lat/lng are set', () => {
    expect(googleMapsLinkFor({ location_lat: 4.05, location_lng: 9.7 })).toBe(
      'https://www.google.com/maps?q=4.05,9.7'
    );
  });

  it('returns null when location was never shared', () => {
    expect(googleMapsLinkFor({ location_lat: null, location_lng: null })).toBeNull();
  });
});

describe('updateTutorRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a malformed WhatsApp number without hitting the network', async () => {
    await expect(
      updateTutorRequest('req-1', {
        categoryId: 'cat-1',
        grade: '3ème',
        neighborhood: 'Akwa',
        budgetMin: null,
        budgetMax: null,
        whatsappContact: '0650123456',
        childIdentifier: null,
      })
    ).rejects.toThrow(/invalid whatsapp/i);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('updates the request by id', async () => {
    const builder = { update: vi.fn(() => builder), eq: vi.fn(() => Promise.resolve({ error: null })) };
    vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

    await updateTutorRequest('req-1', {
      categoryId: 'cat-1',
      grade: '4ème',
      neighborhood: 'Akwa',
      budgetMin: 5000,
      budgetMax: 10000,
      whatsappContact: '+237 650 123 456',
      childIdentifier: 'Junior',
      locationLat: 4.05,
      locationLng: 9.7,
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ grade: '4ème', location_lat: 4.05, location_lng: 9.7 })
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'req-1');
  });
});

describe('cancelTutorRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hard-deletes the request row', async () => {
    const builder = { delete: vi.fn(() => builder), eq: vi.fn(() => Promise.resolve({ error: null })) };
    vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

    await cancelTutorRequest('req-1');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'req-1');
  });
});
