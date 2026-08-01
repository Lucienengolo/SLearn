import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Footer from '../components/Layout/Footer';
import { LocaleProvider } from '../contexts/LocaleContext';

function renderFooter(onNavigate = vi.fn()) {
  return render(
    <LocaleProvider>
      <Footer onNavigate={onNavigate} />
    </LocaleProvider>
  );
}

describe('Footer', () => {
  it('renders the top audience links and navigates on click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderFooter(onNavigate);

    const topNav = screen.getByRole('navigation', { name: /footer audience links/i });
    await user.click(within(topNav).getByRole('button', { name: 'Schools & Universities' }));
    expect(onNavigate).toHaveBeenCalledWith('audience-schools');
  });

  it('renders the 3 link columns with real, existing routes only', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderFooter(onNavigate);

    expect(screen.getByText('For Learners')).toBeInTheDocument();
    expect(screen.getByText('For Educators')).toBeInTheDocument();
    expect(screen.getByText('For Organizations')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Browse courses' }));
    expect(onNavigate).toHaveBeenCalledWith('courses');

    await user.click(screen.getByRole('button', { name: 'Find a tutor' }));
    expect(onNavigate).toHaveBeenCalledWith('my-requests');
  });

  // Regression: this used to assert the opposite (no Terms/Privacy links,
  // since none existed yet) -- flipped 2026-08-01 once real legal documents
  // existed to link to (see lib/legalDocs.ts).
  it('links to the real legal documents (Terms, Privacy, DPA, Refund, Instructor MSA)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderFooter(onNavigate);

    expect(screen.getByText('Legal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Terms of Service' }));
    expect(onNavigate).toHaveBeenCalledWith('legal-terms');

    await user.click(screen.getByRole('button', { name: 'Privacy Policy' }));
    expect(onNavigate).toHaveBeenCalledWith('legal-privacy');
  });

  it('renders the copyright line', () => {
    renderFooter();
    expect(screen.getByText(/Store of Learning/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()}`))).toBeInTheDocument();
  });

  // Regression: founder feedback that "the language doesn't apply to all
  // the platform" -- Footer's link labels/disclaimer were hardcoded English
  // regardless of the FR/EN toggle.
  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderFooter();

    expect(screen.getByText('Pour les apprenants')).toBeInTheDocument();
    expect(screen.getByText('Pour les éducateurs')).toBeInTheDocument();
    expect(screen.getByText('Pour les organisations')).toBeInTheDocument();
    expect(screen.getByText('Mentions légales')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parcourir les cours' })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
