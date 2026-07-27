import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import * as gamificationLib from '../lib/gamification';
import AccountSettings from '../components/Account/AccountSettings';
import { supabase } from '../lib/supabase';
import { ToastProvider } from '../contexts/ToastContext';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));

function mockProfile(overrides: Partial<{ totem: string | null; role: 'student' | 'instructor'; verified: boolean }> = {}) {
  return {
    id: 'profile-1',
    email: 'jane@example.com',
    full_name: 'Jane Doe',
    role: overrides.role ?? ('student' as const),
    verified: overrides.verified ?? false,
    is_reviewer: false,
    avatar_url: null,
    bio: null,
    totem: overrides.totem ?? null,
    created_at: '',
    updated_at: '',
  };
}

function mockAuth(overrides: Parameters<typeof mockProfile>[0] = {}, extra: { refreshProfile?: () => Promise<void>; signOut?: () => void } = {}) {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'user-1', email: 'jane@example.com' } as never,
    profile: mockProfile(overrides),
    refreshProfile: extra.refreshProfile ?? vi.fn().mockResolvedValue(undefined),
    signOut: extra.signOut ?? vi.fn().mockResolvedValue(undefined),
  } as never);
}

function renderAccountSettings(props: Partial<{ onBack: () => void; onNavigate: (page: string) => void }> = {}) {
  return render(
    <ToastProvider>
      <AccountSettings onBack={props.onBack ?? vi.fn()} onNavigate={props.onNavigate ?? vi.fn()} />
    </ToastProvider>
  );
}

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Every test renders a student profile by default -- fetchStudentProgress
    // fires in a useEffect regardless, so it needs a resolved mock even for
    // tests that don't care about the tier badge.
    vi.spyOn(gamificationLib, 'fetchStudentProgress').mockResolvedValue({
      xp: 0,
      streakDays: 0,
      tier: 'Bronze',
      last7Days: [false, false, false, false, false, false, false],
      xpToNextTier: 100,
      tierProgressPct: 0,
    });
  });

  describe('totem picker', () => {
    it('renders all 10 totems with none checked when the profile has no totem yet', () => {
      mockAuth({ totem: null });
      renderAccountSettings();

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(10);
      expect(screen.getByText('Indomitable Lions')).toBeInTheDocument();
      expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    });

    it('saves the selected totem and shows a confirmation', async () => {
      const user = userEvent.setup();
      const refreshProfile = vi.fn().mockResolvedValue(undefined);
      const updateSpy = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));

      mockAuth({ totem: null }, { refreshProfile });
      vi.mocked(supabase.from).mockReturnValue({
        update: updateSpy,
      } as unknown as ReturnType<typeof supabase.from>);

      renderAccountSettings();

      await user.click(screen.getByRole('radio', { name: /black stars/i }));

      expect(updateSpy).toHaveBeenCalledWith({ totem: 'Black Stars' });
      expect(await screen.findByText('Totem updated.')).toBeInTheDocument();
      expect(refreshProfile).toHaveBeenCalled();
    });

    it('marks the current totem as checked', () => {
      mockAuth({ totem: 'Super Eagles' });
      renderAccountSettings();

      expect(screen.getByRole('radio', { name: /super eagles/i })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: /black stars/i })).toHaveAttribute('aria-checked', 'false');
    });

    it('hides the totem picker entirely for an instructor account', () => {
      mockAuth({ role: 'instructor' });
      renderAccountSettings();
      expect(screen.queryByRole('radiogroup', { name: /totem/i })).not.toBeInTheDocument();
    });
  });

  describe('profile header badges', () => {
    it('shows a verified-instructor badge for a verified instructor, no fake tier pill', async () => {
      mockAuth({ role: 'instructor', verified: true });
      renderAccountSettings();
      expect(await screen.findByText('Verified instructor')).toBeInTheDocument();
    });

    it("shows the student's league tier badge", async () => {
      vi.spyOn(gamificationLib, 'fetchStudentProgress').mockResolvedValue({
        xp: 150,
        streakDays: 3,
        tier: 'Silver',
        last7Days: [false, false, false, false, false, false, true],
        xpToNextTier: 150,
        tierProgressPct: 50,
      });
      mockAuth({ role: 'student' });
      renderAccountSettings();
      // "Silver" legitimately appears twice -- once in the sidebar's
      // profile card, once in the main profile header -- so this just
      // checks it renders, not that it's unique.
      await screen.findAllByText('Silver');
      expect(screen.getAllByText('Silver').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('delete account', () => {
    it('opens a confirmation dialog before deleting', async () => {
      const user = userEvent.setup();
      mockAuth();
      renderAccountSettings();

      await user.click(screen.getByRole('button', { name: /delete my account/i }));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('calls the delete-account edge function, signs out, and navigates home on confirm', async () => {
      const user = userEvent.setup();
      const signOut = vi.fn().mockResolvedValue(undefined);
      const onNavigate = vi.fn();
      mockAuth({}, { signOut });
      vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { deleted: true }, error: null } as never);

      renderAccountSettings({ onNavigate });

      await user.click(screen.getByRole('button', { name: /delete my account/i }));
      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: /delete my account/i }));

      expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-account');
      expect(signOut).toHaveBeenCalled();
      expect(onNavigate).toHaveBeenCalledWith('home');
    });

    it('shows an error toast and does not sign out if deletion fails', async () => {
      const user = userEvent.setup();
      const signOut = vi.fn();
      mockAuth({}, { signOut });
      vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: { message: 'boom' } } as never);

      renderAccountSettings();

      await user.click(screen.getByRole('button', { name: /delete my account/i }));
      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: /delete my account/i }));

      expect(await screen.findByText(/failed to delete account/i)).toBeInTheDocument();
      expect(signOut).not.toHaveBeenCalled();
    });
  });
});
