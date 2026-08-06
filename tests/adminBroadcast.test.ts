import { describe, it, expect, vi } from 'vitest';
import { broadcastAnnouncement } from '../lib/adminBroadcast';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

// Admin capabilities batch, 2026-08-06 -- platform-wide announcements
// (0056_admin_capabilities_batch.sql).
describe('adminBroadcast', () => {
  it('broadcastAnnouncement calls broadcast_announcement with audience, title, and body', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await broadcastAnnouncement('instructors', 'Policy update', 'New grading policy in effect');

    expect(supabase.rpc).toHaveBeenCalledWith('broadcast_announcement', {
      p_audience: 'instructors',
      p_title: 'Policy update',
      p_body: 'New grading policy in effect',
    });
  });

  it('broadcastAnnouncement throws when the RPC rejects', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'Only an admin can send a broadcast' } } as never);

    await expect(broadcastAnnouncement('all', 'x', 'y')).rejects.toBeTruthy();
  });
});
