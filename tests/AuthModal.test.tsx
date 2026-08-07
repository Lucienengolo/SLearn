import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import AuthModal from '../components/Auth/AuthModal';
import { LocaleProvider } from '../contexts/LocaleContext';

function renderAuthModal(props: Partial<Parameters<typeof AuthModal>[0]> = {}) {
  return render(
    <LocaleProvider>
      <AuthModal isOpen={props.isOpen ?? true} onClose={props.onClose ?? vi.fn()} onNavigate={props.onNavigate ?? vi.fn()} initialMode={props.initialMode} />
    </LocaleProvider>
  );
}

describe('AuthModal initialMode', () => {
  function mockAuth() {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
    } as never);
  }

  it('opens in login mode by default', () => {
    mockAuth();
    renderAuthModal();
    expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('opens directly in signup mode when initialMode="signup" (landing page CTA)', () => {
    mockAuth();
    renderAuthModal({ initialMode: 'signup' });
    expect(screen.getByRole('dialog', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
  });

  it('re-syncs to the new initialMode each time it reopens, since the component stays mounted', () => {
    mockAuth();
    const { rerender } = render(
      <LocaleProvider>
        <AuthModal isOpen={false} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="login" />
      </LocaleProvider>
    );

    rerender(
      <LocaleProvider>
        <AuthModal isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="signup" />
      </LocaleProvider>
    );
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();

    rerender(
      <LocaleProvider>
        <AuthModal isOpen={false} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="signup" />
      </LocaleProvider>
    );
    rerender(
      <LocaleProvider>
        <AuthModal isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="login" />
      </LocaleProvider>
    );
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });
});

// Regression: Cameroon's Law No. 2024/017 (Personal Data Protection)
// requires consent, and there was previously no consent mechanism at
// signup at all -- a Terms/Privacy checkbox is now required before
// account creation is allowed.
describe('AuthModal signup consent', () => {
  function mockAuth() {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signUp: vi.fn().mockResolvedValue({ needsEmailConfirmation: false }),
      requestPasswordReset: vi.fn(),
    } as never);
  }

  it('disables account creation until the terms checkbox is checked', async () => {
    mockAuth();
    renderAuthModal({ initialMode: 'signup' });

    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Create account' })).not.toBeDisabled();
  });

  it('does not require the checkbox in login mode', () => {
    mockAuth();
    renderAuthModal({ initialMode: 'login' });

    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('clicking the Terms/Privacy links closes the modal and navigates to the legal page', async () => {
    mockAuth();
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    renderAuthModal({ initialMode: 'signup', onClose, onNavigate });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Terms of Service' }));

    expect(onClose).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('legal-terms');
  });
});

// Founder decision, 2026-08-07: capture a parent's WhatsApp number once,
// optionally, at signup -- reused later to prefill tutor requests instead
// of being retyped from scratch every time (RequestForm.tsx).
describe('AuthModal optional WhatsApp field at signup', () => {
  function mockAuth(signUp = vi.fn().mockResolvedValue({ needsEmailConfirmation: false })) {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signUp,
      requestPasswordReset: vi.fn(),
    } as never);
    return signUp;
  }

  it('is not shown in login mode', () => {
    mockAuth();
    renderAuthModal({ initialMode: 'login' });
    expect(screen.queryByLabelText(/whatsapp/i)).not.toBeInTheDocument();
  });

  it('is optional -- signup succeeds with it left blank', async () => {
    const signUp = mockAuth();
    renderAuthModal({ initialMode: 'signup' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), 'Parent One');
    await user.type(screen.getByLabelText(/email/i), 'parent@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await vi.waitFor(() => expect(signUp).toHaveBeenCalledWith('parent@example.com', 'password123', 'Parent One', undefined));
  });

  it('passes a well-formed number through to signUp', async () => {
    const signUp = mockAuth();
    renderAuthModal({ initialMode: 'signup' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), 'Parent One');
    await user.type(screen.getByLabelText(/email/i), 'parent@example.com');
    await user.type(screen.getByLabelText(/whatsapp/i), '+237650123456');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await vi.waitFor(() =>
      expect(signUp).toHaveBeenCalledWith('parent@example.com', 'password123', 'Parent One', '+237650123456')
    );
  });

  it('rejects a malformed number without calling signUp', async () => {
    const signUp = mockAuth();
    renderAuthModal({ initialMode: 'signup' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), 'Parent One');
    await user.type(screen.getByLabelText(/email/i), 'parent@example.com');
    await user.type(screen.getByLabelText(/whatsapp/i), '0650123456');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/expected format/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });
});

// Regression: AuthModal was entirely hardcoded English until 2026-08-01 --
// the whole modal now follows the FR/EN toggle like the rest of the app.
describe('AuthModal locale', () => {
  function mockAuth() {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
    } as never);
  }

  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    mockAuth();

    renderAuthModal({ initialMode: 'signup' });

    expect(screen.getByRole('heading', { name: 'Créez votre compte' })).toBeInTheDocument();
    expect(screen.getByText('Nom complet')).toBeInTheDocument();
    expect(screen.getByText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer un compte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CGU' })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
