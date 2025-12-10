import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isFlightsPage = location.pathname === '/projects/flights';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col">
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
                  className={`hover:text-violet-400 ${
                    location.pathname === to 
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

      {/* Main content - full width for flights, contained otherwise */}
      {isFlightsPage ? (
        <main className="flex-1">{children}</main>
      ) : (
        <main className="max-w-2xl mx-auto px-6 py-12 flex-1 w-full">
          {children}
        </main>
      )}

      {/* Footer - hidden on flights page for immersion */}
      {!isFlightsPage && (
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
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
