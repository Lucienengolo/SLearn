import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { signIn, signUp, requestPasswordReset } = useAuth();
  const isLogin = mode === 'login';

  const handleClose = () => {
    setConfirmationPending(false);
    setResetSent(false);
    setMode('login');
    setError('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email);
        setResetSent(true);
      } else if (isLogin) {
        await signIn(email, password);
        onClose();
      } else {
        const { needsEmailConfirmation } = await signUp(email, password, fullName);
        if (needsEmailConfirmation) {
          setConfirmationPending(true);
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-[14px] max-w-md w-full p-7 relative"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'forgot' ? 'Reset password' : isLogin ? 'Sign in' : 'Create account'}
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-2.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {confirmationPending ? (
          <div className="text-center py-4">
            <span className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={30} className="text-green-600" />
            </span>
            <h2 className="font-display text-2xl mb-2 text-gray-900">Check your email</h2>
            <p className="text-gray-500 text-sm">
              We sent a confirmation link to <strong className="text-gray-700">{email}</strong>. Click it to activate
              your account, then sign in here.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold"
            >
              Got it
            </button>
          </div>
        ) : resetSent ? (
          <div className="text-center py-4">
            <span className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={30} className="text-green-600" />
            </span>
            <h2 className="font-display text-2xl mb-2 text-gray-900">Check your email</h2>
            <p className="text-gray-500 text-sm">
              If an account exists for <strong className="text-gray-700">{email}</strong>, we sent a link to reset
              your password.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold"
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl mb-6 text-gray-900">
              {mode === 'forgot' ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create your account'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-full-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full name
                  </label>
                  <input
                    id="auth-full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    required
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                  required
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError('');
                        }}
                        className="text-2xs text-primary-700 hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    required
                    minLength={8}
                  />
                  {mode === 'signup' && (
                    <p className="text-2xs text-gray-500 mt-1">
                      At least 8 characters, with a mix of uppercase, lowercase and numbers.
                    </p>
                  )}
                </div>
              )}

              {mode === 'signup' && (
                <p className="text-2xs text-gray-500">
                  Every account starts as a learner. You can apply to become an
                  instructor from your dashboard once you're signed in.
                </p>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-[10px] text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
              >
                {loading
                  ? 'Loading…'
                  : mode === 'forgot'
                  ? 'Send reset link'
                  : isLogin
                  ? 'Sign in'
                  : 'Create account'}
              </button>
            </form>

            <div className="mt-4 text-center">
              {mode === 'forgot' ? (
                <button
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="text-primary-700 hover:underline text-sm"
                >
                  Back to sign in
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMode(isLogin ? 'signup' : 'login');
                    setError('');
                  }}
                  className="text-primary-700 hover:underline text-sm"
                >
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
