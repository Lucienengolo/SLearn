import { describe, it, expect, vi } from 'vitest';
import { fetchPendingSettlements, settleMatch } from '../lib/tutorBookingSettlement';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

// Regression: founder report, 2026-08-04 -- with payments disabled there was
// no way to close out a mutually-agreed tutor booking short of direct DB
// access. These wrappers call the reviewer-only, self-verifying
// security-definer RPCs added in 0051_tutor_match_manual_settlement.sql.
describe('tutorBookingSettlement', () => {
  it('fetchPendingSettlements calls get_pending_match_settlements and returns its rows', async () => {
    const rows = [
      {
        match_id: 'match-1',
        confirmed_session_date: '2026-09-01T10:00:00.000Z',
        parent_name: 'Parent One',
        parent_whatsapp: '+237600000000',
        tutor_name: 'Tutor One',
        tutor_whatsapp: '+237611111111',
        rate_per_session: 8000,
      },
    ];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rows, error: null } as never);

    const result = await fetchPendingSettlements();

    expect(supabase.rpc).toHaveBeenCalledWith('get_pending_match_settlements');
    expect(result).toEqual(rows);
  });

  it('fetchPendingSettlements returns an empty array when data is null', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    expect(await fetchPendingSettlements()).toEqual([]);
  });

  it('fetchPendingSettlements throws on error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'not a reviewer' } } as never);

    await expect(fetchPendingSettlements()).rejects.toBeTruthy();
  });

  it('settleMatch calls settle_match_manually with the match id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await settleMatch('match-1');

    expect(supabase.rpc).toHaveBeenCalledWith('settle_match_manually', { p_match_id: 'match-1' });
  });

  it('settleMatch throws when the RPC rejects (e.g. not eligible for settlement)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'Match not eligible for manual settlement' } } as never);

    await expect(settleMatch('match-1')).rejects.toBeTruthy();
  });
});
