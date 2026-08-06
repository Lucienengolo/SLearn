import { describe, it, expect, vi } from 'vitest';
import {
  fetchAllInstructors,
  deactivateInstructor,
  reactivateInstructor,
  setAdminAccess,
  notifyInstructor,
  fetchInstructorNotes,
  addInstructorNote,
} from '../lib/instructors';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
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

  // Admin capabilities batch, 2026-08-06 (0056_admin_capabilities_batch.sql):
  // notify/warn an instructor and keep private notes on them.
  it('notifyInstructor calls notify_instructor with id, title, and body', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await notifyInstructor('i-1', 'Warning', 'Please grade on time.');

    expect(supabase.rpc).toHaveBeenCalledWith('notify_instructor', { p_instructor_id: 'i-1', p_title: 'Warning', p_body: 'Please grade on time.' });
  });

  it('notifyInstructor throws when the RPC rejects', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'Only an admin can notify an instructor' } } as never);

    await expect(notifyInstructor('i-1', 'Warning', 'body')).rejects.toBeTruthy();
  });

  it('fetchInstructorNotes queries instructor_admin_notes for the given instructor', async () => {
    const rows = [{ id: 'n-1', instructor_id: 'i-1', admin_id: 'a-1', note: 'Warned', created_at: '' }];
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    };
    vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchInstructorNotes('i-1');

    expect(supabase.from).toHaveBeenCalledWith('instructor_admin_notes');
    expect(builder.eq).toHaveBeenCalledWith('instructor_id', 'i-1');
    expect(result).toEqual(rows);
  });

  it('fetchInstructorNotes throws on error', async () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => Promise.resolve({ data: null, error: { message: 'denied' } })),
    };
    vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchInstructorNotes('i-1')).rejects.toBeTruthy();
  });

  it('addInstructorNote inserts a row with instructor_id, admin_id, and note', async () => {
    const builder = { insert: vi.fn(() => Promise.resolve({ error: null })) };
    vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

    await addInstructorNote('i-1', 'a-1', 'Warned about late grading');

    expect(supabase.from).toHaveBeenCalledWith('instructor_admin_notes');
    expect(builder.insert).toHaveBeenCalledWith({ instructor_id: 'i-1', admin_id: 'a-1', note: 'Warned about late grading' });
  });

  it('addInstructorNote throws on error', async () => {
    const builder = { insert: vi.fn(() => Promise.resolve({ error: { message: 'denied' } })) };
    vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

    await expect(addInstructorNote('i-1', 'a-1', 'note')).rejects.toBeTruthy();
  });
});
