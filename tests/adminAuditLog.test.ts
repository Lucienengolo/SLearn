import { describe, it, expect, vi } from 'vitest';
import { fetchAdminActionLog } from '../lib/adminAuditLog';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

// Admin capabilities batch, 2026-08-06 -- accountability for admin actions
// (0056_admin_capabilities_batch.sql).
describe('adminAuditLog', () => {
  it('fetchAdminActionLog calls get_admin_action_log and returns its rows', async () => {
    const rows = [{ id: 'l-1', admin_name: 'Admin One', action: 'deactivate_instructor', target_type: 'profile', target_id: 'i-1', detail: null, created_at: '' }];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rows, error: null } as never);

    const result = await fetchAdminActionLog();

    expect(supabase.rpc).toHaveBeenCalledWith('get_admin_action_log');
    expect(result).toEqual(rows);
  });

  it('fetchAdminActionLog returns an empty array when data is null', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    expect(await fetchAdminActionLog()).toEqual([]);
  });

  it('fetchAdminActionLog throws on error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'denied' } } as never);

    await expect(fetchAdminActionLog()).rejects.toBeTruthy();
  });
});
