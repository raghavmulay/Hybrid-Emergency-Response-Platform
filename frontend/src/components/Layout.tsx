import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      isAuthenticated: !!token,
      login: async () => {},
      logout: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('token');
      },
    };
  }
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useSafeAuth();

  // Apply saved theme on initial load
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('token') === 'admin-token';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-indigo-700/80 ${
        location.pathname === to ? 'bg-indigo-800 text-white shadow-sm' : 'text-indigo-100'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="bg-indigo-600 dark:bg-indigo-950 text-white shadow-md border-b border-indigo-700/40 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">🚨</span>
            <div>
              <span className="font-extrabold text-base tracking-tight block">HERP</span>
              <span className="text-[10px] text-indigo-200 block leading-none">
                Emergency Response Platform
              </span>
            </div>
          </div>

          {/* Nav links */}
          {isAuthenticated && (
            <nav className="flex items-center gap-1.5">
              {!isAdmin && navLink('/', '💬 Dispatch Channels')}
              {!isAdmin && navLink('/profile', '👤 Responder Profile')}
              {isAdmin && navLink('/admin', '🛡️ Command Center')}
            </nav>
          )}

          {/* Right side: theme toggle + logout */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="text-xs font-semibold bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
