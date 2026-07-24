import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrollStudentByEmail } from '../lib/instructorEnrollment';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

function mockTables(overrides: { profile?: unknown; existingEnrollment?: unknown; insertError?: unknown }) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(() => {
        if (table === 'profiles') return Promise.resolve({ data: overrides.profile ?? null, error: null });
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
    mockTables({ profile: null });
    await expect(enrollStudentByEmail('course-1', 'nobody@example.com')).rejects.toThrow(/no account found/i);
  });

  it('rejects when the account is not a student', async () => {
    mockTables({ profile: { id: 'user-1', role: 'instructor' } });
    await expect(enrollStudentByEmail('course-1', 'teacher@example.com')).rejects.toThrow(/not a student account/i);
  });

  it('rejects when the student is already enrolled', async () => {
    mockTables({ profile: { id: 'student-1', role: 'student' }, existingEnrollment: { id: 'enr-1' } });
    await expect(enrollStudentByEmail('course-1', 'student@example.com')).rejects.toThrow(/already enrolled/i);
  });

  it('enrolls a valid, not-yet-enrolled student', async () => {
    mockTables({ profile: { id: 'student-1', role: 'student' }, existingEnrollment: null });
    await expect(enrollStudentByEmail('course-1', 'Student@Example.com')).resolves.toBeUndefined();
  });

  it('surfaces the insert error if the RLS policy rejects it', async () => {
    mockTables({
      profile: { id: 'student-1', role: 'student' },
      existingEnrollment: null,
      insertError: { message: 'new row violates row-level security policy' },
    });
    await expect(enrollStudentByEmail('course-1', 'student@example.com')).rejects.toBeTruthy();
  });
});
