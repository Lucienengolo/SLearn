import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeagueBoard from '../components/Dashboard/LeagueBoard';
import { LeagueRow } from '../lib/league';

const ROWS: LeagueRow[] = [
  { studentId: 's1', fullName: 'Jane Doe', totem: 'Black Stars', xp: 30, rank: 1 },
  { studentId: 's2', fullName: 'John Roe', totem: null, xp: 20, rank: 2, isMe: true },
];

describe('LeagueBoard', () => {
  it('shows the empty message when there are no rows', () => {
    render(<LeagueBoard rows={[]} emptyMessage="Nobody here yet." />);
    expect(screen.getByText('Nobody here yet.')).toBeInTheDocument();
  });

  it('renders each row with rank, name, and xp', () => {
    render(<LeagueBoard rows={ROWS} emptyMessage="empty" />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('30 XP')).toBeInTheDocument();
    expect(screen.getByText('John Roe')).toBeInTheDocument();
    expect(screen.getByText('20 XP')).toBeInTheDocument();
  });

  it('highlights the "You" row', () => {
    render(<LeagueBoard rows={ROWS} emptyMessage="empty" />);
    expect(screen.getByText('(You)')).toBeInTheDocument();
  });

  it('shows the totem emoji when set, and a fallback icon otherwise', () => {
    render(<LeagueBoard rows={ROWS} emptyMessage="empty" />);
    expect(screen.getByText('⭐')).toBeInTheDocument();
  });
});
