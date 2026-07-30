import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeagueBoard from '../components/Dashboard/LeagueBoard';
import { LeagueRow } from '../lib/league';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { ComponentProps } from 'react';

const ROWS: LeagueRow[] = [
  { studentId: 's1', fullName: 'Jane Doe', totem: 'Black Stars', xp: 30, rank: 1 },
  { studentId: 's2', fullName: 'John Roe', totem: null, xp: 20, rank: 2, isMe: true },
];

function renderBoard(props: ComponentProps<typeof LeagueBoard>) {
  return render(
    <LocaleProvider>
      <LeagueBoard {...props} />
    </LocaleProvider>
  );
}

describe('LeagueBoard', () => {
  it('shows the empty message when there are no rows', () => {
    renderBoard({ rows: [], emptyMessage: 'Nobody here yet.' });
    expect(screen.getByText('Nobody here yet.')).toBeInTheDocument();
  });

  it('renders each row with rank, name, and xp', () => {
    renderBoard({ rows: ROWS, emptyMessage: 'empty' });
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('30 XP')).toBeInTheDocument();
    expect(screen.getByText('John Roe')).toBeInTheDocument();
    expect(screen.getByText('20 XP')).toBeInTheDocument();
  });

  it('highlights the "You" row', () => {
    renderBoard({ rows: ROWS, emptyMessage: 'empty' });
    expect(screen.getByText('(You)')).toBeInTheDocument();
  });

  it('shows the totem emoji when set, and a fallback icon otherwise', () => {
    renderBoard({ rows: ROWS, emptyMessage: 'empty' });
    expect(screen.getByText('⭐')).toBeInTheDocument();
  });

  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderBoard({ rows: ROWS, emptyMessage: 'empty' });
    expect(screen.getByText('(Vous)')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
