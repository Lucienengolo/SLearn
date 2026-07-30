import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewQueue from '../components/Dashboard/ReviewQueue';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as applicationsLib from '../lib/instructorApplications';
import * as moderationLib from '../lib/courseModeration';

vi.mock('../lib/instructorApplications');
vi.mock('../lib/courseModeration');

function renderReviewQueue() {
  return render(
    <LocaleProvider>
      <ReviewQueue />
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- the reviewer queue (tabs, empty states, decision buttons) was
// hardcoded English regardless of the FR/EN toggle.
describe('ReviewQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applicationsLib.fetchReviewQueue).mockResolvedValue([]);
    vi.mocked(applicationsLib.fetchDecidedApplications).mockResolvedValue([]);
    vi.mocked(moderationLib.fetchPendingCourses).mockResolvedValue([]);
    vi.mocked(moderationLib.fetchDecidedCourses).mockResolvedValue([]);
  });

  it('renders in English by default (jsdom navigator.language)', async () => {
    renderReviewQueue();

    expect(await screen.findByText('Review queue')).toBeInTheDocument();
    expect(screen.getByText(/no applications waiting on a decision/i)).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderReviewQueue();

    expect(await screen.findByText('File de révision')).toBeInTheDocument();
    expect(screen.getByText(/aucune candidature en attente de décision/i)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
