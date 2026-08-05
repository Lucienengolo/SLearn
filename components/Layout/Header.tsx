import { useState, useEffect } from 'react';
import { User, LogOut, Menu, X, Zap, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { getGuestXP, GUEST_XP_EVENT } from '../../lib/guestSession';
import AuthModal from '../Auth/AuthModal';
import NotificationBell from './NotificationBell';
import LanguageToggle from './LanguageToggle';
import AudienceNav from './AudienceNav';
import IconBadge from '../UI/IconBadge';
type HeaderProps = {
  onNavigate: (page: string) => void;
  currentPage: string;
  // Lifted to App.tsx (not local state) so the landing page's own "Sign up"
  // CTA can open the same modal, in signup mode, without duplicating it.
  authModalOpen: boolean;
  authModalMode: 'login' | 'signup';
  onOpenAuthModal: (mode: 'login' | 'signup') => void;
  onCloseAuthModal: () => void;
};

export default function Header({
  onNavigate,
  currentPage,
  authModalOpen,
  authModalMode,
  onOpenAuthModal,
  onCloseAuthModal,
}: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const { t } = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [guestXp, setGuestXp] = useState(0);

  const handleSignOut = async () => {
    await signOut();
    onNavigate('home');
  };

  useEffect(() => {
    setGuestXp(getGuestXP());
    const onGuestXpChanged = () => setGuestXp(getGuestXP());
    window.addEventListener(GUEST_XP_EVENT, onGuestXpChanged);
    return () => window.removeEventListener(GUEST_XP_EVENT, onGuestXpChanged);
  }, []);

  // Which institutional audience track (if any) the user is currently
  // browsing -- reflected in the wordmark itself, not just the page body,
  // per founder feedback that the nav "should reflect its own view" per
  // account track. Home/courses/dashboard etc. show the plain wordmark.
  const AUDIENCE_LABEL: Partial<Record<string, string>> = {
    'audience-schools': 'Schools & Universities',
    'audience-business': 'Business',
    'audience-government': 'Government',
  };
  const audienceLabel = AUDIENCE_LABEL[currentPage];

  return (
    <>
      {/* AudienceNav + header wrapped in one sticky container -- previously
          only the header itself was sticky, so the audience tabs above it
          scrolled away while the header snapped to the very top, a visible
          jump. Both now stay put together on every page, for every account. */}
      <div className="sticky top-0 z-40">
        <AudienceNav onNavigate={onNavigate} currentPage={currentPage} />
        <header className="bg-white/85 backdrop-blur-md border-b border-canvas-150 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-[66px]">
            <div
              className="flex items-center space-x-2.5 cursor-pointer"
              onClick={() => onNavigate('home')}
            >
              <img src="/3D_S-Logo-removebg.png"
              alt="S@Learn logo"
              className="h-9 w-auto" />
              <span className="text-xl font-bold text-gray-900">
                <span className="text-primary-600">@</span>Learn
                {audienceLabel && (
                  <span className="hidden sm:inline text-gray-400 font-medium"> · {audienceLabel}</span>
                )}
              </span>
            </div>

            <nav className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => onNavigate('home')}
                className={`text-md px-3 py-2 rounded-full transition whitespace-nowrap ${
                  currentPage === 'home' ? 'font-semibold text-gray-900 bg-primary-50' : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {t('nav.home')}
              </button>
              <button
                onClick={() => onNavigate('courses')}
                className={`text-md px-3 py-2 rounded-full transition whitespace-nowrap ${
                  currentPage === 'courses' ? 'font-semibold text-gray-900 bg-primary-50' : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {t('nav.courses')}
              </button>
              {user && (
                <button
                  onClick={() => onNavigate('dashboard')}
                  className={`text-md px-3 py-2 rounded-full transition whitespace-nowrap ${
                    currentPage === 'dashboard' ? 'font-semibold text-gray-900 bg-primary-50' : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {t('nav.dashboard')}
                </button>
              )}
              {user && profile?.role === 'student' && (
                <button
                  onClick={() => onNavigate('my-requests')}
                  className={`text-md px-3 py-2 rounded-full transition whitespace-nowrap ${
                    currentPage === 'my-requests' || currentPage === 'tutor-request-new' || currentPage === 'tutor-request-detail'
                      ? 'font-semibold text-gray-900 bg-primary-50'
                      : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {t('nav.tutors')}
                </button>
              )}
              {profile?.is_reviewer && (
                <button
                  onClick={() => onNavigate('review-queue')}
                  className={`text-md px-3 py-2 rounded-full transition whitespace-nowrap ${
                    currentPage === 'review-queue' ? 'font-semibold text-gray-900 bg-primary-50' : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {t('nav.reviewQueue')}
                </button>
              )}
              {profile?.is_admin && (
                <button
                  onClick={() => onNavigate('admin-panel')}
                  className={`text-md px-3 py-2 rounded-full transition whitespace-nowrap ${
                    currentPage === 'admin-panel' ? 'font-semibold text-gray-900 bg-primary-50' : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {t('nav.adminPanel')}
                </button>
              )}
            </nav>

            <div className="hidden lg:flex items-center space-x-3">
              <LanguageToggle />
              {user && profile ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {profile.full_name || user?.email}
                  </span>
                  {/* Founder feedback (2026-07-22): account type shouldn't be
                      a visible label for students -- "instructor" is kept
                      here only because it's a real, verified trust signal,
                      not a generic role tag. The public-facing version of
                      this signal (on course cards, byline) is a separate
                      change -- see CourseCard.tsx/CourseDetail.tsx. */}
                  {profile.role === 'instructor' && profile.verified && (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                      <CheckCircle size={12} />
                      Verified instructor
                    </span>
                  )}
                  <NotificationBell onNavigate={onNavigate} />
                  <button
                    onClick={() => onNavigate('account-settings')}
                    className="rounded-full overflow-hidden border border-gray-200 hover:ring-2 hover:ring-primary-300 transition"
                    title={t('nav.accountSettings')}
                    aria-label={t('nav.accountSettings')}
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-9 h-9 object-cover" />
                    ) : (
                      <IconBadge icon={User} tone="gold" size={36} iconSize={18} />
                    )}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title={t('nav.signOut')}
                    aria-label={t('nav.signOut')}
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <>
                  {guestXp > 0 && (
                    <span
                      className="flex items-center space-x-1 text-xs bg-gold-50 text-gold-700 px-2 py-1 rounded"
                      title="Guest XP — saved only for this browsing session"
                    >
                      <Zap size={14} />
                      <span>{guestXp} XP</span>
                    </span>
                  )}
                  <button
                    onClick={() => onOpenAuthModal('login')}
                    className="flex items-center space-x-2 bg-primary-500 text-gray-900 px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:bg-primary-400 hover:-translate-y-0.5 transition-[box-shadow,transform,background-color]"
                  >
                    <User size={20} />
                    <span>{t('nav.signIn')}</span>
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg"
              aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t">
            <nav className="px-4 py-4 space-y-2">
              <div className="px-4 pb-2">
                <LanguageToggle />
              </div>
              <button
                onClick={() => {
                  onNavigate('home');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('nav.home')}
              </button>
              <button
                onClick={() => {
                  onNavigate('courses');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('nav.courses')}
              </button>
              {user && (
                <button
                  onClick={() => {
                    onNavigate('dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('nav.dashboard')}
                </button>
              )}
              {user && profile?.role === 'student' && (
                <button
                  onClick={() => {
                    onNavigate('my-requests');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('nav.tutors')}
                </button>
              )}
              {profile?.is_reviewer && (
                <button
                  onClick={() => {
                    onNavigate('review-queue');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('nav.reviewQueue')}
                </button>
              )}
              {profile?.is_admin && (
                <button
                  onClick={() => {
                    onNavigate('admin-panel');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('nav.adminPanel')}
                </button>
              )}
              {user && profile ? (
                <div className="pt-2 border-t">
                  <div className="px-4 py-2 text-sm text-gray-600">
                    {profile.full_name || user?.email}
                  </div>
                  <button
                    onClick={() => {
                      onNavigate('account-settings');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <IconBadge icon={User} tone="gold" size={24} iconSize={14} />
                    )}
                    {t('nav.accountSettings')}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    {t('nav.signOut')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {guestXp > 0 && (
                    <div className="flex items-center space-x-1 text-xs text-gold-700 px-4">
                      <Zap size={14} />
                      <span>
                        {guestXp} {t('guest.xpLabel')}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      onOpenAuthModal('login');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-primary-500 text-gray-900 px-4 py-2 rounded-lg hover:bg-primary-400"
                  >
                    {t('nav.signIn')}
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
      </div>

      <AuthModal isOpen={authModalOpen} onClose={onCloseAuthModal} onNavigate={onNavigate} initialMode={authModalMode} />
    </>
  );
}
