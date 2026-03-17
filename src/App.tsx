import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home, About, Projects, NotFound } from './pages';

const Flights = lazy(() => import('./pages/Flights'));
const AnkiArtisan = lazy(() => import('./pages/AnkiArtisan'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));

const basename = import.meta.env.BASE_URL;

function LoadingFallback() {
  return (
    <div className="animate-pulse space-y-4 p-8">
      <div className="h-6 w-48 bg-zinc-800 rounded" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-zinc-800/60 rounded" />
        <div className="h-4 w-5/6 bg-zinc-800/60 rounded" />
        <div className="h-4 w-4/6 bg-zinc-800/60 rounded" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router basename={basename}>
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/flights" element={<Flights />} />
              <Route path="/projects/anki-artisan" element={<AnkiArtisan />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}

