import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LegalDocument from '../components/Legal/LegalDocument';
import { LocaleProvider } from '../contexts/LocaleContext';

function renderDoc(docKey: Parameters<typeof LegalDocument>[0]['docKey'], onBack = vi.fn()) {
  return render(
    <LocaleProvider>
      <LegalDocument docKey={docKey} onBack={onBack} />
    </LocaleProvider>
  );
}

describe('LegalDocument', () => {
  it('renders the Terms of Service with its title and the attorney-review disclaimer', () => {
    renderDoc('terms');
    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText(/not a substitute for review by a licensed Cameroonian attorney/i)).toBeInTheDocument();
  });

  it('renders each of the 5 documents with a distinct title', () => {
    (['terms', 'privacy', 'dpa', 'refund', 'instructor-msa'] as const).forEach((docKey) => {
      const { unmount } = renderDoc(docKey);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      unmount();
    });
  });

  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderDoc('privacy', onBack);

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderDoc('terms');
    expect(screen.getByRole('heading', { name: "Conditions Générales d'Utilisation" })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
