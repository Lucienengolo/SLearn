import { describe, it, expect, vi } from 'vitest';
import { fetchAllInstructors, deactivateInstructor, reactivateInstructor, setAdminAccess } from '../lib/instructors';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

// Regression: founder report, 2026-08-05 -- "app shows 3 instructors" when
// only 1 was really registered (2 were leftover E2E test-fixture profiles,
// since deleted). There was no way to see or manage already-approved
// instructors. These wrappers call the admin-only, self-verifying
// security-definer RPCs added in 0054_admin_role.sql.
describe('instructors', () => {
  it('fetchAllInstructors calls get_all_instructors and returns its rows', async () => {
    const rows = [{ id: 'i-1', email: 'i@example.com', full_name: 'Instructor One', verified: true, created_at: '' }];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rows, error: null } as never);

    const result = await fetchAllInstructors();

    expect(supabase.rpc).toHaveBeenCalledWith('get_all_instructors');
    expect(result).toEqual(rows);
  });

  it('fetchAllInstructors returns an empty array when data is null', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    expect(await fetchAllInstructors()).toEqual([]);
  });

  it('fetchAllInstructors throws on error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'not an admin' } } as never);

    await expect(fetchAllInstructors()).rejects.toBeTruthy();
  });

  it('deactivateInstructor calls deactivate_instructor with the instructor id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await deactivateInstructor('i-1');

    expect(supabase.rpc).toHaveBeenCalledWith('deactivate_instructor', { p_instructor_id: 'i-1' });
  });

  it('deactivateInstructor throws when the RPC rejects (e.g. already inactive)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'No active instructor found for that id' } } as never);

    await expect(deactivateInstructor('i-1')).rejects.toBeTruthy();
  });

  it('reactivateInstructor calls reactivate_instructor with the instructor id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await reactivateInstructor('i-1');

    expect(supabase.rpc).toHaveBeenCalledWith('reactivate_instructor', { p_instructor_id: 'i-1' });
  });

  it('setAdminAccess calls set_admin_access with the email and flag', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await setAdminAccess('someone@example.com', true);

    expect(supabase.rpc).toHaveBeenCalledWith('set_admin_access', { p_target_email: 'someone@example.com', p_is_admin: true });
  });

  it('setAdminAccess throws when the RPC rejects (e.g. caller is not the principal admin)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'Only the principal admin can manage admin access' } } as never);

    await expect(setAdminAccess('someone@example.com', true)).rejects.toBeTruthy();
  });
});
