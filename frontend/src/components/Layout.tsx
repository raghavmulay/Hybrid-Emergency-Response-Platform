import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { createIncident } from '../api/incidents';

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    const token = typeof window !== 'undefined'
      ? sessionStorage.getItem('token') || localStorage.getItem('token')
      : null;
    const role = typeof window !== 'undefined'
      ? (sessionStorage.getItem('role') || localStorage.getItem('role'))
      : null;
    return {
      isAuthenticated: !!token,
      role: (token === 'admin-token' || role === 'admin') ? 'admin' : (token ? 'user' : null),
      login: async () => {},
      logout: () => {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('role');
          localStorage.removeItem('token');
          localStorage.removeItem('role');
        }
      },
    };
  }
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role, logout } = useSafeAuth();

  // SOS modal state
  const [showSOS, setShowSOS] = useState(false);
  const [sosResult, setSosResult] = useState<{ incident_number: string; status: string } | null>(null);
  const [sosError, setSosError] = useState('');

  // Apply saved theme on initial load
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const isAdmin = role === 'admin';
  const isResponder = role === 'responder';
  const isUser = isAuthenticated && !isAdmin && !isResponder;

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

  // SOS submission mutation
  const sosMutation = useMutation({
    mutationFn: async () => {
      // Try to get GPS location, fall back gracefully
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Location unavailable; continue without it
      }

      return createIncident({
        title: `SOS Emergency — ${new Date().toLocaleString()}`,
        type: 'other',
        description: 'SOS alert triggered by user. Immediate assistance required.',
        details: { sos: true, immediate_danger: true },
        latitude: lat,
        longitude: lng,
      });
    },
    onSuccess: (data) => {
      setSosResult({ incident_number: data.incident_number, status: data.status });
      setSosError('');
    },
    onError: (err: Error) => {
      setSosError(`SOS submission failed: ${err.message}. Please call emergency services directly.`);
    },
  });

  const handleSOSConfirm = () => {
    setSosResult(null);
    setSosError('');
    sosMutation.mutate();
  };

  const closeSOS = () => {
    setShowSOS(false);
    setSosResult(null);
    setSosError('');
    sosMutation.reset();
  };

  return (
    <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      <header className="bg-indigo-600 dark:bg-indigo-900 text-white shadow-sm border-b border-indigo-700/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          {/* Brand */}
          <Link
            to={isAdmin ? '/admin' : '/'}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="text-2xl animate-pulse">🚨</span>
            <div>
              <span className="font-extrabold text-base tracking-tight block">HERP</span>
              <span className="text-[10px] text-indigo-200 block leading-none">
                Emergency Response Platform
              </span>
            </div>
          </Link>

          {/* Nav links */}
          {isAuthenticated && (
            <nav className="flex items-center gap-1.5 flex-wrap">
              {isUser && navLink('/', '💬 Dispatch Channels')}
              {isUser && navLink('/report', '🚨 Report Emergency')}
              {isUser && navLink('/my-incidents', '📋 My Incidents')}
              {isUser && navLink('/profile', '👤 Profile')}
              {isAdmin && navLink('/admin', '🛡️ Command Center')}
              {isResponder && navLink('/responder', '🚑 My Assignments')}
            </nav>
          )}

          {/* Right side: SOS + theme toggle + logout */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* SOS button — only for authenticated citizens */}
            {isUser && (
              <button
                onClick={() => setShowSOS(true)}
                className="text-xs font-extrabold bg-red-600 hover:bg-red-500 active:scale-95 text-white px-3 py-1.5 rounded-lg transition-all shadow-sm border border-red-500/50"
                title="Trigger SOS emergency alert"
              >
                🆘 SOS
              </button>
            )}

            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6" style={{ backgroundColor: 'var(--bg)' }}>
        {children}
      </main>

      {/* SOS Modal */}
      {showSOS && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 border-2 border-red-500" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>
            {!sosResult && !sosMutation.isPending && (
              <>
                <div className="text-center">
                  <div className="text-6xl mb-3">🆘</div>
                  <h2 className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Trigger SOS Alert?</h2>
                  <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                    This will immediately create an emergency incident with your current location (if available).
                    Only use this in a real emergency.
                  </p>
                </div>
                {sosError && (
                  <div className="border border-red-400/50 rounded-lg p-3 text-sm text-red-500" style={{ backgroundColor: 'color-mix(in srgb, #ef4444 8%, var(--bg))' }}>
                    {sosError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleSOSConfirm}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm transition-colors"
                  >
                    🆘 Confirm SOS
                  </button>
                  <button
                    onClick={closeSOS}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors hover:opacity-80"
                    style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {sosMutation.isPending && (
              <div className="text-center py-4">
                <div className="text-4xl mb-3 animate-pulse">📡</div>
                <p className="font-bold" style={{ color: 'var(--text)' }}>Sending SOS alert…</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Attempting to attach location…</p>
              </div>
            )}

            {sosResult && (
              <>
                <div className="text-center">
                  <div className="text-6xl mb-3">✅</div>
                  <h2 className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>SOS Submitted</h2>
                </div>
                <div className="rounded-xl p-4 space-y-2 text-sm" style={{ backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                  <p>
                    <span style={{ color: 'var(--text-muted)' }}>Incident: </span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{sosResult.incident_number}</span>
                  </p>
                  <p>
                    <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                    <span className="font-semibold">{sosResult.status.toUpperCase()}</span>
                  </p>
                </div>
                <p className="text-xs text-center" style={{ color: 'var(--text-dim)' }}>
                  Your incident has been recorded. If this is a life-threatening emergency, also call your local emergency number.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { closeSOS(); navigate('/my-incidents'); }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
                  >
                    View My Incidents
                  </button>
                  <button onClick={closeSOS} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
