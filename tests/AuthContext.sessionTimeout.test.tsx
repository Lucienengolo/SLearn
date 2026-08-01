import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { markSessionStart, SESSION_MAX_DURATION_MS } from '../lib/sessionTimeout';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  return <div>{loading ? 'loading' : user ? `signed-in:${user.id}` : 'signed-out'}</div>;
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

const FAKE_USER = { id: 'user-1', email: 'a@example.com' } as never;

// Regression: 72h max-session enforcement (founder request, 2026-08-01).
// A session whose tracked start time is already more than 72h old must be
// signed out on load, not silently kept alive by a valid Supabase token.
describe('AuthContext 72h session timeout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as never);
  });

  it('signs out an already-expired session on load instead of keeping the user signed in', async () => {
    const startedAt = Date.now() - (SESSION_MAX_DURATION_MS + 60_000);
    localStorage.setItem('slearn_session_started_at', String(startedAt));

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: FAKE_USER } },
    } as never);

    renderAuth();

    await waitFor(() => expect(screen.getByText('signed-out')).toBeInTheDocument());
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('keeps a session signed in when it started well within the last 72h', async () => {
    markSessionStart();

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: FAKE_USER } },
    } as never);

    renderAuth();

    await waitFor(() => expect(screen.getByText('signed-in:user-1')).toBeInTheDocument());
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('does not call signOut when there is no session at all to begin with', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never);

    renderAuth();

    await waitFor(() => expect(screen.getByText('signed-out')).toBeInTheDocument());
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
