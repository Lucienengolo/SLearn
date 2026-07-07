import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleClose = () => {
    setConfirmationPending(false);
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
      if (isLogin) {
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
        className="bg-white rounded-lg max-w-md w-full p-6 relative"
        role="dialog"
        aria-modal="true"
        aria-label={isLogin ? 'Sign in' : 'Create account'}
      >
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 p-2.5 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        {confirmationPending ? (
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
            <h2 className="text-xl font-bold mb-2 text-gray-800">Check your email</h2>
            <p className="text-gray-600 text-sm">
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
              account, then sign in here.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition"
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              {isLogin ? 'Sign In' : 'Create Account'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label htmlFor="auth-full-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="auth-full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={8}
                />
                {!isLogin && (
                  <p className="text-xs text-gray-500 mt-1">
                    At least 8 characters, with a mix of uppercase, lowercase and numbers.
                  </p>
                )}
              </div>

              {!isLogin && (
                <p className="text-xs text-gray-500">
                  Every account starts as a learner. You can apply to become an
                  instructor from your dashboard once you're signed in.
                </p>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-blue-600 hover:underline text-sm"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
