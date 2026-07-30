import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import IdentityCapture from '../components/Dashboard/InstructorApplication/IdentityCapture';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { InstructorCredential } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) } },
}));

function renderCapture(credentials: InstructorCredential[] = []) {
  return render(
    <LocaleProvider>
      <IdentityCapture
        userId="user-1"
        applicationId="app-1"
        fullName="Jane Doe"
        address="Akwa"
        credentials={credentials}
        onCredentialUploaded={vi.fn()}
      />
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- the identity-capture step (document/selfie upload prompts)
// was hardcoded English regardless of the FR/EN toggle.
describe('IdentityCapture', () => {
  it('renders in English by default (jsdom navigator.language)', () => {
    renderCapture();

    expect(screen.getByText('Government-issued ID (required)')).toBeInTheDocument();
    expect(screen.getByText('Live selfie (required)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open camera' })).toBeInTheDocument();
  });

  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderCapture();

    expect(screen.getByText("Pièce d'identité officielle (requise)")).toBeInTheDocument();
    expect(screen.getByText('Selfie en direct (requis)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir la caméra' })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
