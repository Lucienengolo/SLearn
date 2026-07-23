import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '../contexts/LocaleContext';
import AudienceNav from '../components/Layout/AudienceNav';

function renderNav(currentPage: string, onNavigate = vi.fn()) {
  render(
    <LocaleProvider>
      <AudienceNav onNavigate={onNavigate} currentPage={currentPage} />
    </LocaleProvider>
  );
  return onNavigate;
}

describe('AudienceNav', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('navigator', { language: 'fr-FR' });
  });

  it('renders exactly 4 audience tabs', () => {
    renderNav('home');
    expect(screen.getByRole('button', { name: /particuliers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /écoles.*universités/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entreprises/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gouvernements/i })).toBeInTheDocument();
  });

  it('marks Individual as active on any non-institutional page, not just "home"', () => {
    renderNav('courses');
    expect(screen.getByRole('button', { name: /particuliers/i })).toHaveAttribute('aria-current', 'page');
  });

  it('marks the matching institutional tab as active', () => {
    renderNav('audience-business');
    expect(screen.getByRole('button', { name: /entreprises/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /particuliers/i })).not.toHaveAttribute('aria-current');
  });

  it('navigates to the matching page on click', async () => {
    const user = userEvent.setup();
    const onNavigate = renderNav('home');
    await user.click(screen.getByRole('button', { name: /écoles.*universités/i }));
    expect(onNavigate).toHaveBeenCalledWith('audience-schools');
  });
});
