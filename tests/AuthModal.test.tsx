import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('opens directly in signup mode when initialMode="signup" (landing page CTA)', () => {
    mockAuth();
    render(<AuthModal isOpen={true} onClose={vi.fn()} initialMode="signup" />);
    expect(screen.getByRole('dialog', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
  });

  it('re-syncs to the new initialMode each time it reopens, since the component stays mounted', () => {
    mockAuth();
    const { rerender } = render(<AuthModal isOpen={false} onClose={vi.fn()} initialMode="login" />);

    rerender(<AuthModal isOpen={true} onClose={vi.fn()} initialMode="signup" />);
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();

    rerender(<AuthModal isOpen={false} onClose={vi.fn()} initialMode="signup" />);
    rerender(<AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />);
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });
});
