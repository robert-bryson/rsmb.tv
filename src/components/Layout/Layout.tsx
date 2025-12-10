import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <header className="bg-gray-800 p-4 shadow-md">
        <nav className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-purple-300 hover:text-purple-200">
            rsmb.tv
          </Link>
          <ul className="flex gap-6 text-sm">
            <li>
              <Link to="/" className="hover:text-purple-300 transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-purple-300 transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link to="/projects" className="hover:text-purple-300 transition-colors">
                Projects
              </Link>
            </li>
            <li>
              <Link to="/blog" className="hover:text-purple-300 transition-colors">
                Blog
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main className="container mx-auto py-8 px-4 flex-1">{children}</main>

      <footer className="bg-gray-800 text-center py-4 text-xs text-gray-400">
        &copy; {new Date().getFullYear()} rsmb.tv
      </footer>
    </div>
  );
}
