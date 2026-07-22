import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminMetrics from '../components/Dashboard/AdminMetrics';
import * as adminMetricsLib from '../lib/adminMetrics';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

describe('AdminMetrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a warm empty state when there are no requests yet', async () => {
    vi.spyOn(adminMetricsLib, 'fetchTutorRequestMatchStats').mockResolvedValue([]);
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => Promise.resolve({ data: [] })),
    } as unknown as ReturnType<typeof supabase.from>);

    render(<AdminMetrics />);

    expect(await screen.findByText(/aucune demande enregistrée/i)).toBeInTheDocument();
  });

  it('renders rows with resolved category names, sorted by unmatched rate', async () => {
    vi.spyOn(adminMetricsLib, 'fetchTutorRequestMatchStats').mockResolvedValue([
      {
        category_id: 'cat-1',
        neighborhood: 'Akwa',
        total_requests: 1,
        unmatched_count: 1,
        matched_count: 0,
        cancelled_count: 0,
        unmatched_rate_pct: 100,
      },
      {
        category_id: 'cat-2',
        neighborhood: 'Bonamoussadi',
        total_requests: 2,
        unmatched_count: 1,
        matched_count: 1,
        cancelled_count: 0,
        unmatched_rate_pct: 50,
      },
    ]);
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() =>
        Promise.resolve({
          data: [
            { id: 'cat-1', name: 'Anglais', description: null, created_at: '' },
            { id: 'cat-2', name: 'Maths', description: null, created_at: '' },
          ],
        })
      ),
    } as unknown as ReturnType<typeof supabase.from>);

    render(<AdminMetrics />);

    expect(await screen.findByText('Anglais')).toBeInTheDocument();
    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.getByText('Akwa')).toBeInTheDocument();
    expect(screen.getByText('Bonamoussadi')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows a load error if the stats fetch fails', async () => {
    vi.spyOn(adminMetricsLib, 'fetchTutorRequestMatchStats').mockRejectedValue(new Error('network error'));
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => Promise.resolve({ data: [] })),
    } as unknown as ReturnType<typeof supabase.from>);

    render(<AdminMetrics />);

    expect(await screen.findByText(/impossible de charger/i)).toBeInTheDocument();
  });
});
