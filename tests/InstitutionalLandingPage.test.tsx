import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '../contexts/LocaleContext';
import InstitutionalLandingPage from '../components/Institutional/InstitutionalLandingPage';
import * as inquiriesLib from '../lib/institutionalInquiries';
import type { InstitutionalInquiry } from '../lib/supabase';

const SAMPLE_INQUIRY: InstitutionalInquiry = {
  id: 'inq-1',
  account_type: 'school_university',
  organization_name: 'Lycee Test',
  contact_name: 'Jane Doe',
  contact_email: 'jane@example.com',
  contact_phone: null,
  message: null,
  created_at: '',
};

function renderPage(accountType: 'school_university' | 'business' | 'government') {
  render(
    <LocaleProvider>
      <InstitutionalLandingPage accountType={accountType} />
    </LocaleProvider>
  );
}

describe('InstitutionalLandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('navigator', { language: 'fr-FR' });
  });

  it('renders audience-specific content for each account type', () => {
    renderPage('school_university');
    expect(screen.getByText(/tuteurs vérifiés de S@Learn/i)).toBeInTheDocument();

    renderPage('government');
    expect(screen.getByText(/partenariat sur l'éducation publique/i)).toBeInTheDocument();
  });

  it('submits the inquiry form and shows a confirmation', async () => {
    const user = userEvent.setup();
    const submitSpy = vi.spyOn(inquiriesLib, 'submitInstitutionalInquiry').mockResolvedValue(SAMPLE_INQUIRY);

    renderPage('school_university');

    await user.type(screen.getByLabelText(/nom de l'organisation/i), 'Lycee Test');
    await user.type(screen.getByLabelText(/votre nom/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/^email$/i), 'jane@example.com');

    await user.click(screen.getByRole('button', { name: /envoyer/i }));

    await waitFor(() =>
      expect(submitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountType: 'school_university',
          organizationName: 'Lycee Test',
          contactName: 'Jane Doe',
          contactEmail: 'jane@example.com',
        })
      )
    );

    expect(await screen.findByText(/merci/i)).toBeInTheDocument();
  });

  it('shows an error and does not clear the form when the submission fails', async () => {
    // Uses a well-formed email so native type="email" constraint validation
    // (which jsdom does enforce) never intercepts the submit -- this tests
    // OUR catch-block error handling for a server-side failure, not the
    // browser's own validation UI.
    const user = userEvent.setup();
    vi.spyOn(inquiriesLib, 'submitInstitutionalInquiry').mockRejectedValue(new Error('Something went wrong. Try again.'));

    renderPage('business');

    await user.type(screen.getByLabelText(/nom de l'organisation/i), 'Acme SARL');
    await user.type(screen.getByLabelText(/votre nom/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/^email$/i), 'jane@example.com');

    await user.click(screen.getByRole('button', { name: /envoyer/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nom de l'organisation/i)).toHaveValue('Acme SARL');
  });
});
