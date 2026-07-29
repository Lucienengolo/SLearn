import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestForm from '../components/Tutors/RequestForm';
import * as tutorRequestsLib from '../lib/tutorRequests';
import * as geolocationLib from '../lib/geolocation';
import type { TutorRequest } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() =>
          Promise.resolve({
            data: [
              { id: 'cat-1', name: 'Mathématiques', description: null, created_at: '' },
              { id: 'cat-2', name: 'Anglais', description: null, created_at: '' },
            ],
          })
        ),
      })),
    })),
  },
}));

function makeRequest(overrides: Partial<TutorRequest> = {}): TutorRequest {
  return {
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
    location_lat: null,
    location_lng: null,
    created_at: '',
    ...overrides,
  };
}

async function fillSharedFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/quartier/i), 'Bonamoussadi');
  await user.type(screen.getByLabelText(/whatsapp/i), '+237 650 123 456');
}

async function fillChild(user: ReturnType<typeof userEvent.setup>, subjectName: RegExp) {
  await waitFor(() => expect(screen.getByLabelText(/niveau/i)).toBeInTheDocument());
  await user.type(screen.getByLabelText(/niveau/i), '3ème');
  await user.click(screen.getByRole('button', { name: subjectName }));
}

describe('RequestForm', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows validation errors and does not submit when required fields are empty', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(tutorRequestsLib, 'createTutorRequest');
    const onSubmitted = vi.fn();

    render(<RequestForm onSubmitted={onSubmitted} />);

    await user.click(screen.getByRole('button', { name: /trouver un tuteur/i }));

    expect(await screen.findByText('Choisissez au moins une matière')).toBeInTheDocument();
    expect(screen.getByText('Indiquez le niveau')).toBeInTheDocument();
    expect(screen.getByText('Indiquez le quartier')).toBeInTheDocument();
    expect(screen.getByText('Numéro WhatsApp requis')).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('rejects a malformed WhatsApp number without calling createTutorRequest', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(tutorRequestsLib, 'createTutorRequest');
    render(<RequestForm onSubmitted={vi.fn()} />);

    await fillChild(user, /^Mathématiques$/);
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

    await fillChild(user, /^Mathématiques$/);
    await fillSharedFields(user);

    const submitButton = screen.getByRole('button', { name: /trouver un tuteur/i });

    // Fire two rapid clicks the way a real double-click/double-tap would --
    // the button becomes disabled ("Recherche en cours…") after the first
    // click resolves synchronously in React's event handling, so the second
    // click should be a no-op, not a second createTutorRequest call.
    await user.click(submitButton);
    await user.click(submitButton);

    expect(createSpy).toHaveBeenCalledTimes(1);

    resolveCreate(makeRequest());

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(matchSpy).toHaveBeenCalledWith('req-1');
  });

  // Regression: a founder-reported bug where "the request tutor matching is
  // not sent" turned out to be createTutorRequest succeeding but
  // matchTutorRequest throwing (the match-tutor-request edge function was
  // undeployed in production) inside the same try block, so the whole
  // submission looked like it failed even though the request row was
  // already saved. onSubmitted must still fire so the parent lands on the
  // "still searching" screen instead of a raw error.
  it('still calls onSubmitted when the request is created but matching fails', async () => {
    const user = userEvent.setup();
    const request = makeRequest();
    vi.spyOn(tutorRequestsLib, 'createTutorRequest').mockResolvedValue(request);
    vi.spyOn(tutorRequestsLib, 'matchTutorRequest').mockRejectedValue(new Error('match-tutor-request unavailable'));
    const onSubmitted = vi.fn();

    render(<RequestForm onSubmitted={onSubmitted} />);

    await fillChild(user, /^Mathématiques$/);
    await fillSharedFields(user);
    await user.click(screen.getByRole('button', { name: /trouver un tuteur/i }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith([request]));
    expect(screen.queryByText(/la demande a échoué/i)).not.toBeInTheDocument();
  });

  it('adds a second child block and creates one request per child', async () => {
    const user = userEvent.setup();
    const createSpy = vi
      .spyOn(tutorRequestsLib, 'createTutorRequest')
      .mockImplementation((input) => Promise.resolve(makeRequest({ id: `req-${input.grade}`, grade: input.grade })));
    vi.spyOn(tutorRequestsLib, 'matchTutorRequest').mockResolvedValue({ matched: false });
    const onSubmitted = vi.fn();

    render(<RequestForm onSubmitted={onSubmitted} />);
    await waitFor(() => expect(screen.getByLabelText(/niveau/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/niveau/i), '3ème');
    await user.click(screen.getByRole('button', { name: /^Mathématiques$/ }));

    await user.click(screen.getByRole('button', { name: /ajouter un autre enfant/i }));
    const gradeInputs = screen.getAllByLabelText(/niveau/i);
    expect(gradeInputs).toHaveLength(2);
    await user.type(gradeInputs[1], '6ème');
    const subjectGroups = screen.getAllByRole('group');
    await user.click(within(subjectGroups[1]).getByRole('button', { name: /^Anglais$/ }));

    await fillSharedFields(user);
    await user.click(screen.getByRole('button', { name: /trouver un tuteur/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2));
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ grade: '3ème', categoryId: 'cat-1' }));
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ grade: '6ème', categoryId: 'cat-2' }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(onSubmitted.mock.calls[0][0]).toHaveLength(2);
  });

  it('creates one request per subject when a child needs several', async () => {
    const user = userEvent.setup();
    const createSpy = vi
      .spyOn(tutorRequestsLib, 'createTutorRequest')
      .mockImplementation((input) => Promise.resolve(makeRequest({ id: `req-${input.categoryId}`, category_id: input.categoryId })));
    vi.spyOn(tutorRequestsLib, 'matchTutorRequest').mockResolvedValue({ matched: false });
    const onSubmitted = vi.fn();

    render(<RequestForm onSubmitted={onSubmitted} />);
    await waitFor(() => expect(screen.getByLabelText(/niveau/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/niveau/i), '3ème');
    await user.click(screen.getByRole('button', { name: /^Mathématiques$/ }));
    await user.click(screen.getByRole('button', { name: /^Anglais$/ }));
    await fillSharedFields(user);

    await user.click(screen.getByRole('button', { name: /trouver un tuteur/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(onSubmitted.mock.calls[0][0]).toHaveLength(2);
  });

  it('removes a child block via "Retirer" once there is more than one', async () => {
    const user = userEvent.setup();
    render(<RequestForm onSubmitted={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/niveau/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /ajouter un autre enfant/i }));
    expect(screen.getAllByLabelText(/niveau/i)).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: /retirer/i })[0]);
    expect(screen.getAllByLabelText(/niveau/i)).toHaveLength(1);
    // The last remaining child block has no "Retirer" button.
    expect(screen.queryByRole('button', { name: /retirer/i })).not.toBeInTheDocument();
  });

  it('shares a successfully-fetched location across every request created in the submission', async () => {
    const user = userEvent.setup();
    vi.spyOn(geolocationLib, 'getCurrentLocation').mockResolvedValue({ lat: 4.05, lng: 9.7 });
    const createSpy = vi.spyOn(tutorRequestsLib, 'createTutorRequest').mockResolvedValue(makeRequest());
    vi.spyOn(tutorRequestsLib, 'matchTutorRequest').mockResolvedValue({ matched: false });

    render(<RequestForm onSubmitted={vi.fn()} />);
    await fillChild(user, /^Mathématiques$/);
    await fillSharedFields(user);

    await user.click(screen.getByRole('button', { name: /partager ma position/i }));
    expect(await screen.findByText(/position partagée/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /trouver un tuteur/i }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ locationLat: 4.05, locationLng: 9.7 }))
    );
  });

  it('shows an error and does not block submission if location sharing fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(geolocationLib, 'getCurrentLocation').mockRejectedValue(new Error('Permission refusée'));

    render(<RequestForm onSubmitted={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /partager ma position/i }));

    expect(await screen.findByText('Permission refusée')).toBeInTheDocument();
  });
});
