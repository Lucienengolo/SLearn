import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LandingPage from '../components/Home/LandingPage';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

function mockTables(reviews: unknown[] = []) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      not: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve({ data: table === 'reviews' ? reviews : [] })),
      then: (resolve: (v: { count: number; data: unknown }) => void) =>
        Promise.resolve({ count: 0, data: [] }).then(resolve),
    };
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the hero headline and both CTAs', () => {
    mockTables();
    render(<LandingPage onNavigate={vi.fn()} onGetStarted={vi.fn()} />);

    expect(screen.getByText(/one platform to learn, teach, and get tutored/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /get started free|create free account/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /browse courses/i }).length).toBeGreaterThan(0);
  });

  it('calls onGetStarted from the hero CTA and onNavigate("courses") from Browse courses', async () => {
    mockTables();
    const user = userEvent.setup();
    const onGetStarted = vi.fn();
    const onNavigate = vi.fn();
    render(<LandingPage onNavigate={onNavigate} onGetStarted={onGetStarted} />);

    await user.click(screen.getAllByRole('button', { name: /get started free/i })[0]);
    expect(onGetStarted).toHaveBeenCalled();

    await user.click(screen.getAllByRole('button', { name: /browse courses/i })[0]);
    expect(onNavigate).toHaveBeenCalledWith('courses');
  });

  it('omits the testimonials section when there are no qualifying reviews', async () => {
    mockTables([]);
    render(<LandingPage onNavigate={vi.fn()} onGetStarted={vi.fn()} />);

    expect(screen.queryByText(/what learners are saying/i)).not.toBeInTheDocument();
  });

  it('renders real reviews as testimonials, not fabricated quotes', async () => {
    mockTables([
      {
        id: 'rev-1',
        rating: 5,
        comment: 'This course changed how I think about pricing.',
        student: { full_name: 'Aïcha Mbarga' },
        course: { title: 'Digital Marketing Basics' },
      },
    ]);
    render(<LandingPage onNavigate={vi.fn()} onGetStarted={vi.fn()} />);

    expect(await screen.findByText(/what learners are saying/i)).toBeInTheDocument();
    expect(screen.getByText(/this course changed how i think about pricing/i)).toBeInTheDocument();
    expect(screen.getByText('Aïcha Mbarga')).toBeInTheDocument();
    expect(screen.getByText('Digital Marketing Basics')).toBeInTheDocument();
  });
});
