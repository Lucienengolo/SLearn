import { useState, useEffect } from 'react';
import { User, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../Auth/AuthModal';

type HeaderProps = {
  onNavigate: (page: string) => void;
  currentPage: string;
};

export default function Header({ onNavigate, currentPage }: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(true);

  const handleSignOut = async () => {
    await signOut();
    onNavigate('home');
  };

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      setIsScrollingUp(currentY <= lastScrollY);
      lastScrollY = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
  <header className={`sticky top-0 z-40 transition-colors duration-300 ${isScrollingUp ? 'bg-transparent shadow-none' : 'bg-white shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => onNavigate('home')}
            >
              <img src="/dist/assets/3D_S-Logo-removebg.png"
                alt="LearnHub logo"
                className="h-10 w-auto"/>
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

            <div className="hidden md:flex items-center space-x-4">
              {user && profile ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {profile.full_name || profile.email}
                  </span>
                  <span className="text-xs bg-primary-100 text-primary-600 px-2 py-1 rounded">
                    {profile.role}
                  </span>
                    <button
                      onClick={handleSignOut}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      title="Sign Out"
                    >
                      <LogOut size={20} />
                    </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                >
                  <User size={20} />
                  <span>Sign In</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
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
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Sign In
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
