import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardSidebar from '../components/Dashboard/DashboardSidebar';

describe('DashboardSidebar', () => {
  it('renders all 4 destinations and marks the current one active', () => {
    render(<DashboardSidebar current="certificates" onNavigate={vi.fn()} />);

    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my requests/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();

    const certificatesButton = screen.getByRole('button', { name: /certificates/i });
    expect(certificatesButton).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /^dashboard$/i })).not.toHaveAttribute('aria-current');
  });

  it('navigates to the matching page on click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<DashboardSidebar current="dashboard" onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: /profile/i }));
    expect(onNavigate).toHaveBeenCalledWith('account-settings');

    await user.click(screen.getByRole('button', { name: /my requests/i }));
    expect(onNavigate).toHaveBeenCalledWith('my-requests');
  });
});
