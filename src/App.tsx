import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { Home, About, Projects, NotFound } from './pages';

const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const ThroughRoutes = lazy(() => import('./pages/ThroughRoutes'));
const FlightsAbout = lazy(() => import('./pages/FlightsAbout'));
const Flights = lazy(() => import('./pages/Flights'));
const AnkiArtisan = lazy(() => import('./pages/AnkiArtisan'));
const Bookend = lazy(() => import('./pages/Bookend'));
const TemperatureRecordsAbout = lazy(() => import('./pages/TemperatureRecordsAbout'));
const TemperatureRecords = lazy(() => import('./pages/TemperatureRecords'));
const ClimateTrendsPage = lazy(() => import('./pages/ClimateTrends'));
const Route2Gpx = lazy(() => import('./pages/Route2Gpx'));
const Aborg = lazy(() => import('./pages/Aborg'));

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
      <ScrollToTop />
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/through-routes" element={<ThroughRoutes />} />
              <Route path="/projects/flights" element={<FlightsAbout />} />
              <Route path="/projects/flights/map" element={<Flights />} />
              <Route path="/projects/anki-artisan" element={<AnkiArtisan />} />
              <Route path="/projects/bookend" element={<Bookend />} />
              <Route path="/projects/temperature-records" element={<TemperatureRecordsAbout />} />
              <Route path="/projects/temperature-records/map" element={<TemperatureRecords />} />
              <Route path="/projects/temperature-records/trends" element={<ClimateTrendsPage />} />
              <Route path="/projects/route2gpx" element={<Route2Gpx />} />
              <Route path="/projects/aborg" element={<Aborg />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}

