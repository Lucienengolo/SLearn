import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import IconBadge from '../UI/IconBadge';

type Mode = 'login' | 'signup' | 'forgot';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  initialMode?: Mode;
};

export default function AuthModal({ isOpen, onClose, onNavigate, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { signIn, signUp, requestPasswordReset } = useAuth();
  const { t } = useLocale();
  const isLogin = mode === 'login';

  const handleClose = () => {
    setConfirmationPending(false);
    setResetSent(false);
    setMode('login');
    setError('');
    setAgreedToTerms(false);
    onClose();
  };

  // Terms/Privacy links close the modal and navigate away -- signup
  // progress (email/password already typed) is lost, same tradeoff most
  // signup-with-legal-links flows accept rather than opening a second
  // overlay on top of this one.
  const handleLegalLinkClick = (page: string) => {
    handleClose();
    onNavigate(page);
  };

  // Syncs on every open (not just first mount) -- this component stays
  // mounted persistently in Header, so a plain useState(initialMode)
  // initializer would only apply once and ignore later callers (e.g. the
  // landing page's "Sign up" CTA) that want a different starting mode.
  useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);

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
      setError(err instanceof Error ? err.message : t('auth.genericError'));
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
        aria-label={mode === 'forgot' ? t('auth.ariaResetPassword') : isLogin ? t('auth.ariaSignIn') : t('auth.ariaCreateAccount')}
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-2.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
          aria-label={t('auth.closeAria')}
        >
          <X size={20} />
        </button>

        {confirmationPending ? (
          <div className="text-center py-4">
            <IconBadge icon={CheckCircle} tone="green" size={56} iconSize={30} className="mx-auto mb-4" />
            <h2 className="font-display text-2xl mb-2 text-gray-900">{t('auth.checkYourEmail')}</h2>
            <p className="text-gray-500 text-sm">
              {t('auth.confirmationSentPrefix')} <strong className="text-gray-700">{email}</strong>. {t('auth.confirmationSentSuffix')}
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold"
            >
              {t('auth.gotIt')}
            </button>
          </div>
        ) : resetSent ? (
          <div className="text-center py-4">
            <IconBadge icon={CheckCircle} tone="green" size={56} iconSize={30} className="mx-auto mb-4" />
            <h2 className="font-display text-2xl mb-2 text-gray-900">{t('auth.checkYourEmail')}</h2>
            <p className="text-gray-500 text-sm">
              {t('auth.resetSentPrefix')} <strong className="text-gray-700">{email}</strong>, {t('auth.resetSentSuffix')}
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold"
            >
              {t('auth.gotIt')}
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl mb-6 text-gray-900">
              {mode === 'forgot' ? t('auth.titleResetPassword') : isLogin ? t('auth.titleWelcomeBack') : t('auth.titleCreateAccount')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-full-name" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('auth.fullNameLabel')}
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
                  {t('auth.emailLabel')}
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
                      {t('auth.passwordLabel')}
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
                        {t('auth.forgotPassword')}
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
                      {t('auth.passwordHint')}
                    </p>
                  )}
                </div>
              )}

              {mode === 'signup' && (
                <>
                  <p className="text-2xs text-gray-500">
                    {t('auth.everyAccountNote')}
                  </p>

                  <label className="flex items-start gap-2 text-2xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5"
                      required
                    />
                    <span>
                      {t('auth.agreeToPrefix')}{' '}
                      <button
                        type="button"
                        onClick={() => handleLegalLinkClick('legal-terms')}
                        className="text-primary-700 hover:underline"
                      >
                        {t('legal.terms')}
                      </button>{' '}
                      {t('auth.agreeToAnd')}{' '}
                      <button
                        type="button"
                        onClick={() => handleLegalLinkClick('legal-privacy')}
                        className="text-primary-700 hover:underline"
                      >
                        {t('legal.privacy')}
                      </button>
                    </span>
                  </label>
                </>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-[10px] text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (mode === 'signup' && !agreedToTerms)}
                className="w-full bg-primary-500 text-gray-900 h-11 rounded-[10px] hover:bg-primary-400 transition font-semibold disabled:opacity-50"
              >
                {loading
                  ? t('common.loadingEllipsis')
                  : mode === 'forgot'
                  ? t('auth.sendResetLink')
                  : isLogin
                  ? t('auth.ariaSignIn')
                  : t('auth.ariaCreateAccount')}
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
                  {t('auth.backToSignIn')}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMode(isLogin ? 'signup' : 'login');
                    setError('');
                  }}
                  className="text-primary-700 hover:underline text-sm"
                >
                  {isLogin ? t('auth.noAccountSignUp') : t('auth.haveAccountSignIn')}
                </button>
              )}
            </div>

            {mode !== 'forgot' && (
              <div className="mt-5 pt-4 border-t border-canvas-150 text-center">
                <button
                  onClick={handleClose}
                  className="text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  {t('auth.notReadyPrefix')} <span className="font-medium text-gray-700 underline">{t('auth.browseGuestSuffix')}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
