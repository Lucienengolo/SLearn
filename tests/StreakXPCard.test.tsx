import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StreakXPCard from '../components/Dashboard/StreakXPCard';
import type { StudentProgress } from '../lib/gamification';
import { totemByName } from '../lib/totems';

function makeProgress(overrides: Partial<StudentProgress> = {}): StudentProgress {
  return {
    xp: 20,
    streakDays: 2,
    tier: 'Bronze',
    last7Days: [false, false, false, false, false, true, true],
    xpToNextTier: 80,
    tierProgressPct: 20,
    ...overrides,
  };
}

describe('StreakXPCard', () => {
  it('renders the streak week-strip, credits, and tier progress bar (Product Register, DESIGN.md 2026-07-24)', () => {
    const { container } = render(
      <StreakXPCard progress={makeProgress()} totem={null} onEditTotem={vi.fn()} />
    );

    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(screen.getByText('20 credits earned')).toBeInTheDocument();
    expect(screen.getByText('Bronze League')).toBeInTheDocument();
    expect(screen.getByText('80 credits to Silver')).toBeInTheDocument();
    expect(container.querySelectorAll('svg.lucide-flame').length).toBeGreaterThan(0);
    expect(container.querySelector('svg.lucide-trophy')).toBeInTheDocument();
  });

  it('shows "Top tier reached" instead of a next-tier target at Gold', () => {
    render(
      <StreakXPCard
        progress={makeProgress({ tier: 'Gold', xp: 400, xpToNextTier: null, tierProgressPct: 100 })}
        totem={null}
        onEditTotem={vi.fn()}
      />
    );
    expect(screen.getByText('Top tier reached')).toBeInTheDocument();
    expect(screen.queryByText(/credits to/i)).not.toBeInTheDocument();
  });

  it('renders the totem badge when one is set, and a placeholder + "Pick a totem" CTA when not', () => {
    const { rerender } = render(<StreakXPCard progress={makeProgress()} totem={null} onEditTotem={vi.fn()} />);
    expect(screen.getByText('No totem picked yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pick a totem/i })).toBeInTheDocument();

    rerender(
      <StreakXPCard progress={makeProgress()} totem={totemByName('Indomitable Lions')} onEditTotem={vi.fn()} />
    );
    expect(screen.getByText('Indomitable Lions')).toBeInTheDocument();
    expect(screen.getByText('🦁')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
  });

  it('calls onEditTotem when the totem card action is clicked', async () => {
    const user = userEvent.setup();
    const onEditTotem = vi.fn();
    render(<StreakXPCard progress={makeProgress()} totem={null} onEditTotem={onEditTotem} />);

    await user.click(screen.getByRole('button', { name: /pick a totem/i }));
    expect(onEditTotem).toHaveBeenCalled();
  });
});
