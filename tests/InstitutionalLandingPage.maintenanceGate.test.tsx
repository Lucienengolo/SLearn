import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '../contexts/LocaleContext';
import InstitutionalLandingPage from '../components/Institutional/InstitutionalLandingPage';

function renderPage(accountType: 'school_university' | 'business' | 'government') {
  return render(
    <LocaleProvider>
      <InstitutionalLandingPage accountType={accountType} />
    </LocaleProvider>
  );
}

// Regression: founder decision, 2026-08-04 -- the School/Business/
// Government tracks show a maintenance notice instead of their real
// content. INSTITUTIONAL_PAGES_ENABLED is false by default (see
// lib/institutionalPagesConfig.ts, not mocked in this file -- unlike
// InstitutionalLandingPage.test.tsx, which mocks it true to keep
// exercising the underlying page).
describe('InstitutionalLandingPage maintenance gate (disabled by default)', () => {
  it('shows a maintenance notice instead of the real page for every account type', () => {
    for (const accountType of ['school_university', 'business', 'government'] as const) {
      const { unmount } = renderPage(accountType);
      expect(screen.getByText('This page is under maintenance')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
      unmount();
    }
  });
});
