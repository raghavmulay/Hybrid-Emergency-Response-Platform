import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  // Apply saved theme on initial load
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-indigo-600 dark:bg-indigo-800 text-white p-4 flex justify-between items-center">
        <nav className="flex space-x-4">
          <Link to="/" className={location.pathname === '/' ? 'underline' : ''}>Home</Link>
          <Link to="/profile" className={location.pathname === '/profile' ? 'underline' : ''}>Profile</Link>
          <Link to="/admin" className={location.pathname === '/admin' ? 'underline' : ''}>Admin</Link>
        </nav>
        <ThemeToggle />
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
};

export default Layout;
