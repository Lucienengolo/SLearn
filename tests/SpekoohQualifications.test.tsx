import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as spekoohLib from '../lib/spekoohMarkingRequests';
import SpekoohQualifications from '../components/Dashboard/SpekoohQualifications';
import * as authContext from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { LocaleProvider } from '../contexts/LocaleContext';

vi.mock('../lib/spekoohMarkingRequests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/spekoohMarkingRequests')>();
  return {
    ...actual,
    fetchSpekoohCategories: vi.fn(),
    fetchMyQualifications: vi.fn(),
    saveSpekoohQualifications: vi.fn(),
  };
});

function mockAuth() {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'instructor-1', email: 'i@example.com' } as never,
  } as never);
}

const CATEGORIES = [
  { key: 'primary', title: 'Primary' },
  { key: 'secondary', title: 'Secondary' },
  { key: 'university', title: 'University' },
];

function renderPanel() {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <SpekoohQualifications />
      </ToastProvider>
    </LocaleProvider>
  );
}

describe('SpekoohQualifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
  });

  it('lists Spekooh\'s live categories and pre-checks the instructor\'s saved ones', async () => {
    vi.mocked(spekoohLib.fetchSpekoohCategories).mockResolvedValue(CATEGORIES);
    vi.mocked(spekoohLib.fetchMyQualifications).mockResolvedValue(['secondary']);
    renderPanel();

    expect(await screen.findByRole('checkbox', { name: 'Secondary' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Primary' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'University' })).not.toBeChecked();
    expect(spekoohLib.fetchMyQualifications).toHaveBeenCalledWith('instructor-1');
  });

  it('saves exactly the checked categories', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchSpekoohCategories).mockResolvedValue(CATEGORIES);
    vi.mocked(spekoohLib.fetchMyQualifications).mockResolvedValue(['secondary']);
    vi.mocked(spekoohLib.saveSpekoohQualifications).mockResolvedValue({});
    renderPanel();
    await screen.findByRole('checkbox', { name: 'Secondary' });

    await user.click(screen.getByRole('checkbox', { name: 'University' }));
    await user.click(screen.getByRole('button', { name: /save qualifications/i }));

    await waitFor(() =>
      expect(spekoohLib.saveSpekoohQualifications).toHaveBeenCalledWith(expect.arrayContaining(['secondary', 'university']))
    );
    expect(vi.mocked(spekoohLib.saveSpekoohQualifications).mock.calls[0][0]).toHaveLength(2);
    expect(await screen.findByText('Qualifications saved.')).toBeInTheDocument();
  });

  it('unchecking a category removes it from what gets saved', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchSpekoohCategories).mockResolvedValue(CATEGORIES);
    vi.mocked(spekoohLib.fetchMyQualifications).mockResolvedValue(['secondary', 'university']);
    vi.mocked(spekoohLib.saveSpekoohQualifications).mockResolvedValue({});
    renderPanel();
    await screen.findByRole('checkbox', { name: 'Secondary' });

    await user.click(screen.getByRole('checkbox', { name: 'University' }));
    await user.click(screen.getByRole('button', { name: /save qualifications/i }));

    await waitFor(() => expect(spekoohLib.saveSpekoohQualifications).toHaveBeenCalledWith(['secondary']));
  });

  it('shows a warning toast, not a success one, when the save reaches S@Learn but not Spekooh', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchSpekoohCategories).mockResolvedValue(CATEGORIES);
    vi.mocked(spekoohLib.fetchMyQualifications).mockResolvedValue([]);
    vi.mocked(spekoohLib.saveSpekoohQualifications).mockResolvedValue({ warning: 'Saved here, but Spekooh could not be reached' });
    renderPanel();
    await screen.findByRole('checkbox', { name: 'Secondary' });

    await user.click(screen.getByRole('checkbox', { name: 'Secondary' }));
    await user.click(screen.getByRole('button', { name: /save qualifications/i }));

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument();
  });

  it('shows a failure toast when the save call itself throws', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchSpekoohCategories).mockResolvedValue(CATEGORIES);
    vi.mocked(spekoohLib.fetchMyQualifications).mockResolvedValue([]);
    vi.mocked(spekoohLib.saveSpekoohQualifications).mockRejectedValue(new Error('network'));
    renderPanel();
    await screen.findByRole('checkbox', { name: 'Secondary' });

    await user.click(screen.getByRole('button', { name: /save qualifications/i }));

    expect(await screen.findByText('Could not save your qualifications, please try again.')).toBeInTheDocument();
  });

  it('offers a retry when the category list cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(spekoohLib.fetchSpekoohCategories).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(CATEGORIES);
    vi.mocked(spekoohLib.fetchMyQualifications).mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText('Could not load your qualifications.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('checkbox', { name: 'Secondary' })).toBeInTheDocument();
  });
});
