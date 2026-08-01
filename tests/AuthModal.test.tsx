import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import AuthModal from '../components/Auth/AuthModal';

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
    render(<AuthModal isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('opens directly in signup mode when initialMode="signup" (landing page CTA)', () => {
    mockAuth();
    render(<AuthModal isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="signup" />);
    expect(screen.getByRole('dialog', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
  });

  it('re-syncs to the new initialMode each time it reopens, since the component stays mounted', () => {
    mockAuth();
    const { rerender } = render(<AuthModal isOpen={false} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="login" />);

    rerender(<AuthModal isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="signup" />);
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();

    rerender(<AuthModal isOpen={false} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="signup" />);
    rerender(<AuthModal isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="login" />);
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
    render(<AuthModal isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="signup" />);

    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Create account' })).not.toBeDisabled();
  });

  it('does not require the checkbox in login mode', () => {
    mockAuth();
    render(<AuthModal isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} initialMode="login" />);

    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('clicking the Terms/Privacy links closes the modal and navigates to the legal page', async () => {
    mockAuth();
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<AuthModal isOpen={true} onClose={onClose} onNavigate={onNavigate} initialMode="signup" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Terms of Service' }));

    expect(onClose).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('legal-terms');
  });
});
