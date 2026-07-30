import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardSidebar from '../components/Dashboard/DashboardSidebar';
import { totemByName } from '../lib/totems';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { ComponentProps } from 'react';

function renderSidebar(props: ComponentProps<typeof DashboardSidebar>) {
  return render(
    <LocaleProvider>
      <DashboardSidebar {...props} />
    </LocaleProvider>
  );
}

describe('DashboardSidebar', () => {
  it('renders all 7 student destinations and marks the current one active', () => {
    renderSidebar({ current: 'certificates', onNavigate: vi.fn() });

    expect(screen.getByRole('button', { name: /^dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /league/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my requests/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /for teachers/i })).toBeInTheDocument();

    const certificatesButton = screen.getByRole('button', { name: /certificates/i });
    expect(certificatesButton).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /^dashboard$/i })).not.toHaveAttribute('aria-current');
  });

  it('navigates to the matching page on click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSidebar({ current: 'dashboard', onNavigate });

    await user.click(screen.getByRole('button', { name: /profile/i }));
    expect(onNavigate).toHaveBeenCalledWith('account-settings');

    await user.click(screen.getByRole('button', { name: /my requests/i }));
    expect(onNavigate).toHaveBeenCalledWith('my-requests');

    await user.click(screen.getByRole('button', { name: /my progress/i }));
    expect(onNavigate).toHaveBeenCalledWith('my-progress');

    await user.click(screen.getByRole('button', { name: /^league$/i }));
    expect(onNavigate).toHaveBeenCalledWith('league');

    await user.click(screen.getByRole('button', { name: /for teachers/i }));
    expect(onNavigate).toHaveBeenCalledWith('become-instructor');
  });

  it('renders no profile header when no name/totem/tier are given', () => {
    renderSidebar({ current: 'dashboard', onNavigate: vi.fn() });
    expect(screen.queryByText('Student')).not.toBeInTheDocument();
  });

  it('renders the profile header with totem, name, and tier pill when provided', () => {
    const totem = totemByName('Indomitable Lions');
    renderSidebar({ current: 'dashboard', onNavigate: vi.fn(), fullName: 'Jane Doe', totem, tier: 'Silver' });

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('🦁')).toBeInTheDocument();
  });

  it('hides the student-only items for an instructor', () => {
    renderSidebar({ current: 'account-settings', onNavigate: vi.fn(), role: 'instructor' });

    expect(screen.getByRole('button', { name: /^dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /my requests/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /certificates/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /my progress/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /league/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /for teachers/i })).not.toBeInTheDocument();
  });

  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderSidebar({ current: 'my-progress', onNavigate: vi.fn(), fullName: 'Jane Doe', tier: 'Silver' });

    expect(screen.getByRole('button', { name: /mes progrès/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /classement/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mes demandes/i })).toBeInTheDocument();
    expect(screen.getByText('Argent')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
