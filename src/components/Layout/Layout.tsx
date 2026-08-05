import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { projects } from '../../content/projects';

interface LayoutProps {
  children: ReactNode;
}

const navLinks = [
  { to: '/blog', label: 'Blog' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];

function isNavLinkActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

function getNavLinkClassName(isActive: boolean) {
  return `hover:text-violet-400 ${isActive ? 'text-violet-400' : 'text-zinc-400'}`;
}

function getProjectLinkClassName(isActive: boolean) {
  const activeClassName = isActive
    ? 'bg-zinc-800/70 text-violet-300'
    : 'text-zinc-400';

  return `block truncate px-4 py-1.5 hover:bg-zinc-800/60 hover:text-violet-400 ${activeClassName}`;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isFullScreenPage = location.pathname.endsWith('/map');

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
            {navLinks.map(({ to, label }) => {
              if (to === '/projects') {
                const isActive = isNavLinkActive(location.pathname, to);
                return (
                  <li
                    key={to}
                    className="group relative"
                  >
                    <Link
                      to={to}
                      aria-haspopup="true"
                      className={getNavLinkClassName(isActive)}
                    >
                      {label}
                    </Link>
                    <div className="invisible absolute right-0 top-full z-50 min-w-52 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      <ul
                        aria-label="Project pages"
                        className="rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-lg"
                      >
                        {projects.map((project) => (
                          <li key={project.slug}>
                            <Link
                              to={`/projects/${project.slug}`}
                              className={getProjectLinkClassName(isNavLinkActive(location.pathname, `/projects/${project.slug}`))}
                            >
                              {project.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              }
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={getNavLinkClassName(isNavLinkActive(location.pathname, to))}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* Main content */}
      <main id="main-content" className="max-w-2xl mx-auto px-6 py-12 flex-1 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50">
        <div className="max-w-2xl mx-auto px-6 py-6 flex justify-between items-center text-sm text-zinc-400">
          <span>© {new Date().getFullYear()} · {__BUILD_DATE__}</span>
          <div className="flex gap-4">
            <a
              href="https://github.com/robert-bryson"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300"
            >
              GitHub
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
