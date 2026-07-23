import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreakXPCard from '../components/Dashboard/StreakXPCard';
import type { StudentProgress } from '../lib/gamification';

describe('StreakXPCard', () => {
  it('renders XP, streak day count, and tier as plain text (no icons/emoji)', () => {
    const progress: StudentProgress = { xp: 120, streakDays: 4, tier: 'Silver' };
    render(<StreakXPCard progress={progress} />);

    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('4 days')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '4 day streak' })).toBeInTheDocument();
  });

  it('caps the visible streak ticks at 7 even for a longer streak', () => {
    const progress: StudentProgress = { xp: 400, streakDays: 12, tier: 'Gold' };
    const { container } = render(<StreakXPCard progress={progress} />);

    const ticks = container.querySelectorAll('span.w-3\\.5.h-3\\.5');
    expect(ticks).toHaveLength(7);
    const filled = container.querySelectorAll('span.w-3\\.5.h-3\\.5.bg-oxblood');
    expect(filled).toHaveLength(7);
    expect(screen.getByText('12 days')).toBeInTheDocument();
  });

  it('uses singular "day" for a 1-day streak', () => {
    const progress: StudentProgress = { xp: 10, streakDays: 1, tier: 'Bronze' };
    render(<StreakXPCard progress={progress} />);
    expect(screen.getByText('1 day')).toBeInTheDocument();
  });
});
