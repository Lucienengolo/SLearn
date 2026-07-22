import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider, useLocale } from '../contexts/LocaleContext';
import LanguageToggle from '../components/Layout/LanguageToggle';

// Stand-in for how Header.tsx actually consumes the context -- one
// translated nav label plus the toggle, same shape as real chrome.
function TestChrome() {
  const { t } = useLocale();
  return (
    <div>
      <nav>{t('nav.home')}</nav>
      <LanguageToggle />
    </div>
  );
}

describe('LocaleContext + LanguageToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('navigator', { language: 'fr-FR' });
  });

  it('defaults to French chrome copy when no preference is stored (D10 fallback)', () => {
    render(
      <LocaleProvider>
        <TestChrome />
      </LocaleProvider>
    );
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });

  it('switches all chrome copy when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <TestChrome />
      </LocaleProvider>
    );

    expect(screen.getByText('Accueil')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Accueil')).not.toBeInTheDocument();
  });

  it('persists the chosen locale across a remount (simulating navigation)', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <LocaleProvider>
        <TestChrome />
      </LocaleProvider>
    );

    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText('Home')).toBeInTheDocument();

    unmount();

    // A fresh mount (new provider instance) simulates navigating to a
    // different page that remounts the header chrome from scratch.
    render(
      <LocaleProvider>
        <TestChrome />
      </LocaleProvider>
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('marks the active locale button as pressed for a11y', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <TestChrome />
      </LocaleProvider>
    );

    expect(screen.getByRole('button', { name: 'FR' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(screen.getByRole('button', { name: 'FR' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
  });
});
