import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreakXPCard from '../components/Dashboard/StreakXPCard';
import type { StudentProgress } from '../lib/gamification';

describe('StreakXPCard', () => {
  it('renders streak days, XP, and tier with real icons (Product register, DESIGN.md 2026-07-24)', () => {
    const progress: StudentProgress = { xp: 120, streakDays: 4, tier: 'Silver' };
    const { container } = render(<StreakXPCard progress={progress} />);

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-flame')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-zap')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-trophy')).toBeInTheDocument();
  });

  it('renders a distinct tint per tier', () => {
    const { container: bronze } = render(
      <StreakXPCard progress={{ xp: 10, streakDays: 1, tier: 'Bronze' }} />
    );
    const { container: gold } = render(<StreakXPCard progress={{ xp: 400, streakDays: 12, tier: 'Gold' }} />);

    expect(bronze.querySelector('.bg-orange-50.text-orange-700')).toBeInTheDocument();
    expect(gold.querySelector('.bg-primary-50.text-primary-700')).toBeInTheDocument();
  });
});
