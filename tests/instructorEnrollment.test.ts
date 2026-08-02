import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrollStudentByEmail } from '../lib/instructorEnrollment';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

// Regression: profiles.email is no longer selectable via a direct query
// (2026-08-02 security fix, 0046_restrict_profile_email.sql) -- the student
// lookup now goes through the find_student_id_by_email security-definer
// RPC, which returns id/role only (never email).
function mockTables(overrides: { matches?: unknown[]; existingEnrollment?: unknown; insertError?: unknown }) {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: overrides.matches ?? [], error: null } as never);
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(() => {
        if (table === 'enrollments') return Promise.resolve({ data: overrides.existingEnrollment ?? null, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
      insert: vi.fn(() => Promise.resolve({ error: overrides.insertError ?? null })),
    };
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

describe('enrollStudentByEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an empty email without hitting the network', async () => {
    mockTables({});
    await expect(enrollStudentByEmail('course-1', '   ')).rejects.toThrow(/enter a student email/i);
  });

  it('rejects when no account exists for that email', async () => {
    mockTables({ matches: [] });
    await expect(enrollStudentByEmail('course-1', 'nobody@example.com')).rejects.toThrow(/no account found/i);
  });

  it('rejects when the account is not a student', async () => {
    mockTables({ matches: [{ id: 'user-1', role: 'instructor' }] });
    await expect(enrollStudentByEmail('course-1', 'teacher@example.com')).rejects.toThrow(/not a student account/i);
  });

  it('rejects when the student is already enrolled', async () => {
    mockTables({ matches: [{ id: 'student-1', role: 'student' }], existingEnrollment: { id: 'enr-1' } });
    await expect(enrollStudentByEmail('course-1', 'student@example.com')).rejects.toThrow(/already enrolled/i);
  });

  it('enrolls a valid, not-yet-enrolled student', async () => {
    mockTables({ matches: [{ id: 'student-1', role: 'student' }], existingEnrollment: null });
    await expect(enrollStudentByEmail('course-1', 'Student@Example.com')).resolves.toBeUndefined();
    expect(supabase.rpc).toHaveBeenCalledWith('find_student_id_by_email', { p_email: 'student@example.com' });
  });

  it('surfaces the insert error if the RLS policy rejects it', async () => {
    mockTables({
      matches: [{ id: 'student-1', role: 'student' }],
      existingEnrollment: null,
      insertError: { message: 'new row violates row-level security policy' },
    });
    await expect(enrollStudentByEmail('course-1', 'student@example.com')).rejects.toBeTruthy();
  });
});
