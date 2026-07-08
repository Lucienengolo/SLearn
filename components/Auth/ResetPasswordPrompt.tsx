import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// Shown app-wide (see App.tsx) whenever AuthContext detects a
// PASSWORD_RECOVERY auth event -- the user arrived via the link from
// requestPasswordReset's email and Supabase has already established a
// real (recovery-scoped) session for them. This blocks the rest of the
// app until they set a new password, matching what that link is for.
export default function ResetPasswordPrompt() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[14px] max-w-md w-full p-7" role="dialog" aria-modal="true" aria-label="Set a new password">
        {done ? (
          <div className="text-center py-4">
            <h2 className="font-display text-2xl mb-2 text-gray-900">Password updated</h2>
            <p className="text-gray-500 text-sm mb-6">You're all set — continue to the app.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold"
            >
              Continue
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl mb-2 text-gray-900">Set a new password</h2>
            <p className="text-gray-500 text-sm mb-6">Choose a new password for your account.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm new password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                  required
                  minLength={8}
                />
              </div>
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-[10px] text-sm">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
