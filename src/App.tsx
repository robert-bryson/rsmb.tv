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
    <div className="flex items-center justify-center p-8">
      <div className="text-zinc-500">Loading...</div>
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

