import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../components/Home/HomePage';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as authContext from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

function mockTables() {
  vi.mocked(supabase.from).mockImplementation(() => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve({ data: [] })),
      in: vi.fn(() => Promise.resolve({ data: [] })),
      then: (resolve: (v: { count: number; data: unknown[] }) => void) =>
        Promise.resolve({ count: 0, data: [] }).then(resolve),
    };
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

function renderHomePage() {
  return render(
    <LocaleProvider>
      <HomePage
        onNavigate={vi.fn()}
        onCourseSelect={vi.fn()}
        onSearchCourses={vi.fn()}
        onFilterByCategory={vi.fn()}
      />
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- HomePage was 100% hardcoded English regardless of the FR/EN
// toggle. Confirms the French locale genuinely changes what renders.
describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ user: null } as never);
    mockTables();
  });

  it('renders in English by default (jsdom navigator.language)', async () => {
    renderHomePage();
    expect(await screen.findByText('Learn the skills that grow your income')).toBeInTheDocument();
    expect(screen.getByText('Why choose S@Learn?')).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderHomePage();

    expect(await screen.findByText('Apprenez les compétences qui font grandir vos revenus')).toBeInTheDocument();
    expect(screen.getByText('Pourquoi choisir S@Learn ?')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
