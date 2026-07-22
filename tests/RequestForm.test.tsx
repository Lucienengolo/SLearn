import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestForm from '../components/Tutors/RequestForm';
import * as tutorRequestsLib from '../lib/tutorRequests';
import type { TutorRequest } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() =>
          Promise.resolve({
            data: [{ id: 'cat-1', name: 'Mathématiques', description: null, created_at: '' }],
          })
        ),
      })),
    })),
  },
}));

const SAMPLE_REQUEST: TutorRequest = {
  id: 'req-1',
  parent_id: 'p1',
  category_id: 'cat-1',
  grade: '3ème',
  neighborhood: 'Bonamoussadi',
  budget_min: null,
  budget_max: null,
  whatsapp_contact: '+237650123456',
  child_identifier: null,
  preferred_language: 'fr',
  status: 'searching',
  created_at: '',
};

describe('RequestForm', () => {
  it('shows validation errors and does not submit when required fields are empty', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(tutorRequestsLib, 'createTutorRequest');
    const onSubmitted = vi.fn();

    render(<RequestForm onSubmitted={onSubmitted} />);

    await user.click(screen.getByRole('button', { name: /trouver un tuteur/i }));

    expect(await screen.findByText('Choisissez une matière')).toBeInTheDocument();
    expect(screen.getByText('Indiquez le niveau')).toBeInTheDocument();
    expect(screen.getByText('Indiquez le quartier')).toBeInTheDocument();
    expect(screen.getByText('Numéro WhatsApp requis')).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('rejects a malformed WhatsApp number without calling createTutorRequest', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(tutorRequestsLib, 'createTutorRequest');
    render(<RequestForm onSubmitted={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/matière/i)).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/matière/i), 'cat-1');
    await user.type(screen.getByLabelText(/niveau/i), '3ème');
    await user.type(screen.getByLabelText(/quartier/i), 'Bonamoussadi');
    await user.type(screen.getByLabelText(/whatsapp/i), '0650123456');

    await user.click(screen.getByRole('button', { name: /trouver un tuteur/i }));

    expect(await screen.findByText(/format attendu/i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('only creates one request when the submit button is double-clicked', async () => {
    const user = userEvent.setup();
    let resolveCreate: (value: TutorRequest) => void = () => {};
    const createSpy = vi
      .spyOn(tutorRequestsLib, 'createTutorRequest')
      .mockReturnValue(new Promise<TutorRequest>((resolve) => (resolveCreate = resolve)));
    const matchSpy = vi.spyOn(tutorRequestsLib, 'matchTutorRequest').mockResolvedValue({ matched: false });
    const onSubmitted = vi.fn();

    render(<RequestForm onSubmitted={onSubmitted} />);

    await waitFor(() => expect(screen.getByLabelText(/matière/i)).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/matière/i), 'cat-1');
    await user.type(screen.getByLabelText(/niveau/i), '3ème');
    await user.type(screen.getByLabelText(/quartier/i), 'Bonamoussadi');
    await user.type(screen.getByLabelText(/whatsapp/i), '+237 650 123 456');

    const submitButton = screen.getByRole('button', { name: /trouver un tuteur/i });

    // Fire two rapid clicks the way a real double-click/double-tap would --
    // the button becomes disabled ("Recherche en cours…") after the first
    // click resolves synchronously in React's event handling, so the second
    // click should be a no-op, not a second createTutorRequest call.
    await user.click(submitButton);
    await user.click(submitButton);

    expect(createSpy).toHaveBeenCalledTimes(1);

    resolveCreate(SAMPLE_REQUEST);

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(matchSpy).toHaveBeenCalledWith('req-1');
  });
});
