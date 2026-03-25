import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/blog', label: 'Blog' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isFullScreenPage = location.pathname === '/projects/flights/map' || location.pathname === '/projects/temperature-records/map';

  // Full screen mode for map pages
  if (isFullScreenPage) {
    return (
      <div className="h-dvh w-screen overflow-hidden bg-[#000011]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col">
      {/* Skip to content — visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-violet-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="border-b border-zinc-800/50">
        <nav className="max-w-2xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link
            to="/"
            className="text-lg font-medium text-zinc-100 hover:text-violet-400"
          >
            rsmb
          </Link>
          <ul className="flex gap-6 text-sm">
            {navLinks.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={`hover:text-violet-400 ${location.pathname === to
                    ? 'text-violet-400'
                    : 'text-zinc-400'
                    }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Main content */}
      <main id="main-content" className="max-w-2xl mx-auto px-6 py-12 flex-1 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50">
        <div className="max-w-2xl mx-auto px-6 py-6 flex justify-between items-center text-sm text-zinc-500">
          <span>© {new Date().getFullYear()}</span>
          <div className="flex gap-4">
            <a
              href="https://github.com/robert-bryson"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/robert-bryson"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300"
            >
              LinkedIn
            </a>
            <a href="/rss.xml" className="hover:text-zinc-300">
              RSS
            </a>
            <a href="/sitemap.xml" className="hover:text-zinc-300">
              Sitemap
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
