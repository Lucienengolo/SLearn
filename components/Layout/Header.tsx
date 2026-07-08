import { useState, useEffect } from 'react';
import { User, LogOut, Menu, X, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getGuestXP, GUEST_XP_EVENT } from '../../lib/guestSession';
import AuthModal from '../Auth/AuthModal';
type HeaderProps = {
  onNavigate: (page: string) => void;
  currentPage: string;
};

export default function Header({ onNavigate, currentPage }: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
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

  return (
    <>
  <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => onNavigate('home')}
            >
              <img src="/3D_S-Logo-removebg.png"
              alt="S@Learn logo"
              className="h-10 w-auto" />
              <span className="text-xl font-bold text-gray-800">@Learn</span>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => onNavigate('home')}
                className={`font-medium transition ${
                  currentPage === 'home' ? 'text-primary-600' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => onNavigate('courses')}
                className={`font-medium transition ${
                  currentPage === 'courses' ? 'text-primary-600' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Courses
              </button>
              {user && (
                <button
                  onClick={() => onNavigate('dashboard')}
                  className={`font-medium transition ${
                    currentPage === 'dashboard' ? 'text-primary-600' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Dashboard
                </button>
              )}
            </nav>

            <div className="hidden md:flex items-center space-x-3">
              {user && profile ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {profile.full_name || profile.email}
                  </span>
                  <span className="text-xs bg-primary-100 text-primary-600 px-2 py-1 rounded">
                    {profile.role}
                  </span>
                  <button
                    onClick={() => onNavigate('account-settings')}
                    className="rounded-full overflow-hidden border border-gray-200 hover:ring-2 hover:ring-primary-300 transition"
                    title="Account settings"
                    aria-label="Account settings"
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-9 h-9 object-cover" />
                    ) : (
                      <span className="w-9 h-9 flex items-center justify-center bg-primary-100 text-primary-700">
                        <User size={18} />
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title="Sign Out"
                    aria-label="Sign out"
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
                    onClick={() => setAuthModalOpen(true)}
                    className="flex items-center space-x-2 bg-primary-500 text-gray-900 px-4 py-2 rounded-lg hover:bg-primary-400 transition"
                  >
                    <User size={20} />
                    <span>Sign In</span>
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t">
            <nav className="px-4 py-4 space-y-2">
              <button
                onClick={() => {
                  onNavigate('home');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Home
              </button>
              <button
                onClick={() => {
                  onNavigate('courses');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Courses
              </button>
              {user && (
                <button
                  onClick={() => {
                    onNavigate('dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Dashboard
                </button>
              )}
              {user && profile ? (
                <div className="pt-2 border-t">
                  <div className="px-4 py-2 text-sm text-gray-600">
                    {profile.full_name || profile.email}
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
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
                        <User size={14} />
                      </span>
                    )}
                    Account settings
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {guestXp > 0 && (
                    <div className="flex items-center space-x-1 text-xs text-gold-700 px-4">
                      <Zap size={14} />
                      <span>{guestXp} guest XP (this session)</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setAuthModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-primary-500 text-gray-900 px-4 py-2 rounded-lg hover:bg-primary-400"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
