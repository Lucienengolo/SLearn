import { describe, it, expect, vi } from 'vitest';
import { fetchAllMatchesAdmin, resolveDispute } from '../lib/adminDisputes';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

// Admin capabilities batch, 2026-08-06 -- nothing anywhere previously
// transitioned a match OUT of dispute_review (0056_admin_capabilities_batch.sql).
describe('adminDisputes', () => {
  it('fetchAllMatchesAdmin calls get_all_matches_admin and returns its rows', async () => {
    const rows = [{ match_id: 'm-1', status: 'dispute_review', confirmed_session_date: null, parent_name: 'P', tutor_name: 'T', created_at: '' }];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rows, error: null } as never);

    const result = await fetchAllMatchesAdmin();

    expect(supabase.rpc).toHaveBeenCalledWith('get_all_matches_admin');
    expect(result).toEqual(rows);
  });

  it('fetchAllMatchesAdmin returns an empty array when data is null', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    expect(await fetchAllMatchesAdmin()).toEqual([]);
  });

  it('resolveDispute calls resolve_dispute with the match id and resolution', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await resolveDispute('m-1', 'completed');

    expect(supabase.rpc).toHaveBeenCalledWith('resolve_dispute', { p_match_id: 'm-1', p_resolution: 'completed' });
  });

  it('resolveDispute throws when the RPC rejects (e.g. not a dispute_review match)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'No dispute-review match found for that id' } } as never);

    await expect(resolveDispute('m-1', 'cancelled_refunded')).rejects.toBeTruthy();
  });
});
