import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyRequests from '../components/Tutors/MyRequests';
import * as tutorRequestsLib from '../lib/tutorRequests';
import type { TutorRequestListItem } from '../lib/tutorRequests';

function makeRequest(overrides: Partial<TutorRequestListItem> = {}): TutorRequestListItem {
  return {
    id: 'req-1',
    parent_id: 'parent-1',
    category_id: 'cat-1',
    grade: '3ème',
    neighborhood: 'Bonamoussadi',
    budget_min: null,
    budget_max: null,
    whatsapp_contact: '+237600000000',
    child_identifier: 'Junior',
    preferred_language: 'fr',
    status: 'searching',
    created_at: '',
    categories: { name: 'Maths' },
    ...overrides,
  };
}

describe('MyRequests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a warm, actionable empty state with no requests yet', async () => {
    vi.spyOn(tutorRequestsLib, 'fetchMyTutorRequests').mockResolvedValue([]);
    const onNewRequest = vi.fn();

    render(<MyRequests parentId="parent-1" onSelectRequest={vi.fn()} onNewRequest={onNewRequest} />);

    expect(await screen.findByText(/vous n'avez pas encore fait de demande/i)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /faire ma première demande/i }));
    expect(onNewRequest).toHaveBeenCalled();
  });

  it('lists requests labeled by child_identifier, subject, grade, and neighborhood', async () => {
    vi.spyOn(tutorRequestsLib, 'fetchMyTutorRequests').mockResolvedValue([
      makeRequest({ id: 'req-1', child_identifier: 'Junior', status: 'searching' }),
      makeRequest({ id: 'req-2', child_identifier: null, status: 'matched' }),
    ]);

    render(<MyRequests parentId="parent-1" onSelectRequest={vi.fn()} onNewRequest={vi.fn()} />);

    expect(await screen.findByText('Junior')).toBeInTheDocument();
    expect(screen.getByText('Enfant non précisé')).toBeInTheDocument();
    expect(screen.getByText('Recherche en cours')).toBeInTheDocument();
    expect(screen.getByText('Tuteur trouvé')).toBeInTheDocument();
    expect(screen.getAllByText(/maths · 3ème · bonamoussadi/i)).toHaveLength(2);
  });

  it('calls onSelectRequest with the right id when a request row is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(tutorRequestsLib, 'fetchMyTutorRequests').mockResolvedValue([makeRequest({ id: 'req-42' })]);
    const onSelectRequest = vi.fn();

    render(<MyRequests parentId="parent-1" onSelectRequest={onSelectRequest} onNewRequest={vi.fn()} />);

    await user.click(await screen.findByText('Junior'));
    expect(onSelectRequest).toHaveBeenCalledWith('req-42');
  });

  it('always shows a "new request" action even when requests already exist', async () => {
    const user = userEvent.setup();
    vi.spyOn(tutorRequestsLib, 'fetchMyTutorRequests').mockResolvedValue([makeRequest()]);
    const onNewRequest = vi.fn();

    render(<MyRequests parentId="parent-1" onSelectRequest={vi.fn()} onNewRequest={onNewRequest} />);

    await user.click(await screen.findByRole('button', { name: /nouvelle demande/i }));
    expect(onNewRequest).toHaveBeenCalled();
  });

  it('shows a load error message if fetching requests fails', async () => {
    vi.spyOn(tutorRequestsLib, 'fetchMyTutorRequests').mockRejectedValue(new Error('network'));
    render(<MyRequests parentId="parent-1" onSelectRequest={vi.fn()} onNewRequest={vi.fn()} />);
    expect(await screen.findByText(/impossible de charger vos demandes/i)).toBeInTheDocument();
  });
});
