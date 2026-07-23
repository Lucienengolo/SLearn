import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import AccountSettings from '../components/Account/AccountSettings';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

function mockProfile(totem: string | null = null) {
  return {
    id: 'profile-1',
    email: 'jane@example.com',
    full_name: 'Jane Doe',
    role: 'student' as const,
    verified: false,
    is_reviewer: false,
    avatar_url: null,
    bio: null,
    totem,
    created_at: '',
    updated_at: '',
  };
}

describe('AccountSettings totem picker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all 10 totems with none checked when the profile has no totem yet', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'jane@example.com' } as never,
      profile: mockProfile(null),
      refreshProfile: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn(),
    } as never);

    render(<AccountSettings onBack={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(10);
    expect(screen.getByText('Indomitable Lions')).toBeInTheDocument();
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('saves the selected totem and shows a confirmation', async () => {
    const user = userEvent.setup();
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    const updateSpy = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));

    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'jane@example.com' } as never,
      profile: mockProfile(null),
      refreshProfile,
      signOut: vi.fn(),
    } as never);
    vi.mocked(supabase.from).mockReturnValue({
      update: updateSpy,
    } as unknown as ReturnType<typeof supabase.from>);

    render(<AccountSettings onBack={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: /black stars/i }));

    expect(updateSpy).toHaveBeenCalledWith({ totem: 'Black Stars' });
    expect(await screen.findByText('Totem updated.')).toBeInTheDocument();
    expect(refreshProfile).toHaveBeenCalled();
  });

  it('renders a mascot emoji badge for each totem, not text only', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'jane@example.com' } as never,
      profile: mockProfile(null),
      refreshProfile: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn(),
    } as never);

    render(<AccountSettings onBack={vi.fn()} />);

    expect(screen.getAllByText('🦁')).toHaveLength(3); // Indomitable/Teranga/Atlas Lions, distinguished by badge color
    expect(screen.getByText('🦅')).toBeInTheDocument();
    expect(screen.getByText('🐘')).toBeInTheDocument();
  });

  it('marks the current totem as checked', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'jane@example.com' } as never,
      profile: mockProfile('Super Eagles'),
      refreshProfile: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn(),
    } as never);

    render(<AccountSettings onBack={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /super eagles/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /black stars/i })).toHaveAttribute('aria-checked', 'false');
  });
});
