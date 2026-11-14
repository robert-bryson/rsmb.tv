import { BrowserRouter as Router, Navigate, Routes, Route, useLocation, useSearchParams } from 'react-router-dom';
import { Suspense, lazy, useLayoutEffect } from 'react';
import { pageLoaders } from './navigation/pageLoaders';
import { intentPrefetch } from './navigation/intentPrefetch';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { RouteOrientation } from './components/RouteOrientation';
import { MapPerformance } from './components/MapPerformance';
import { canonicalPathname } from './utils/siteMetadata';
import { Home } from './pages/Home';

const About = lazy(pageLoaders['/about']);
const Projects = lazy(pageLoaders['/projects']);
const NotFound = lazy(pageLoaders['notFound']);
const Posts = lazy(pageLoaders['/posts']);
const BlogPost = lazy(pageLoaders['article']);
const ThroughRoutes = lazy(pageLoaders['/projects/through-routes']);
const FlightsAbout = lazy(pageLoaders['/projects/flights']);
const Flights = lazy(pageLoaders['/projects/flights/map']);
const AnkiArtisan = lazy(pageLoaders['/projects/anki-artisan']);
const Bookend = lazy(pageLoaders['/projects/bookend']);
const TemperatureRecordsAbout = lazy(pageLoaders['/projects/temperature-records']);
const TemperatureRecords = lazy(pageLoaders['/projects/temperature-records/map']);
const ClimateTrendsPage = lazy(pageLoaders['/projects/temperature-records/trends']);
const TornadoTracksAbout = lazy(pageLoaders['/projects/tornado-tracks']);
const TornadoTracks = lazy(pageLoaders['/projects/tornado-tracks/map']);
const Route2Gpx = lazy(pageLoaders['/projects/route2gpx']);
const Aborg = lazy(pageLoaders['/projects/aborg']);
const Parc = lazy(pageLoaders['/projects/parc']);
const StatusDashboard = lazy(pageLoaders['/projects/status-dashboard']);
const AdvAtlas = lazy(pageLoaders['/projects/adv-atlas/map']);
const PinsOfInaccessibilityAbout = lazy(pageLoaders['/projects/pins-of-inaccessibility']);
const PinsOfInaccessibility = lazy(pageLoaders['/projects/pins-of-inaccessibility/map']);

const basename = import.meta.env.BASE_URL;

export function LegacyPostsRedirect({ type }: { type: 'writing' | 'trips' }) {
  const [searchParams] = useSearchParams();
  const { hash, state } = useLocation();
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set('type', type);

  return <Navigate to={{ pathname: '/posts', search: nextSearchParams.toString(), hash }} state={state} replace />;
}

export function AdvAtlasRedirect() {
  const { search, hash, state } = useLocation();
  return <Navigate to={{ pathname: '/projects/adv-atlas/map', search, hash }} state={state} replace />;
}

function LoadingFallback() {
  return (
    <div role="status" className="animate-pulse motion-reduce:animate-none space-y-6 p-8 max-w-2xl min-h-[60vh]">
      <span className="sr-only">Loading page…</span>
      <div className="h-7 w-48 max-w-full bg-zinc-800 rounded" />
      <div className="h-4 w-32 max-w-full bg-zinc-800/40 rounded" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-zinc-800/60 rounded" />
        <div className="h-4 w-5/6 bg-zinc-800/60 rounded" />
        <div className="h-4 w-4/6 bg-zinc-800/60 rounded" />
      </div>
      <div className="h-48 w-full bg-zinc-800/40 rounded-lg" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-zinc-800/60 rounded" />
        <div className="h-4 w-3/4 bg-zinc-800/60 rounded" />
      </div>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const pathname = canonicalPathname(location.pathname);
  if (pathname !== location.pathname) {
    return <Navigate to={{ pathname, search: location.search, hash: location.hash }} state={location.state} replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/posts" element={<Posts />} />
      <Route path="/blog" element={<LegacyPostsRedirect type="writing" />} />
      <Route path="/blog/:slug" element={<BlogPost collection="blog" />} />
      <Route path="/trips" element={<LegacyPostsRedirect type="trips" />} />
      <Route path="/trips/:slug" element={<BlogPost collection="trips" />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/adv-atlas" element={<AdvAtlasRedirect />} />
      <Route path="/projects/adv-atlas/map" element={<AdvAtlas />} />
      <Route path="/projects/pins-of-inaccessibility" element={<PinsOfInaccessibilityAbout />} />
      <Route path="/projects/pins-of-inaccessibility/map" element={<PinsOfInaccessibility />} />
      <Route path="/projects/motorcycle-trips" element={<AdvAtlasRedirect />} />
      <Route path="/projects/motorcycle-trips/map" element={<AdvAtlasRedirect />} />
      <Route path="/projects/through-routes" element={<ThroughRoutes />} />
      <Route path="/projects/flights" element={<FlightsAbout />} />
      <Route path="/projects/flights/map" element={<Flights />} />
      <Route path="/projects/anki-artisan" element={<AnkiArtisan />} />
      <Route path="/projects/bookend" element={<Bookend />} />
      <Route path="/projects/temperature-records" element={<TemperatureRecordsAbout />} />
      <Route path="/projects/temperature-records/map" element={<TemperatureRecords />} />
      <Route path="/projects/temperature-records/trends" element={<ClimateTrendsPage />} />
      <Route path="/projects/tornado-tracks" element={<TornadoTracksAbout />} />
      <Route path="/projects/tornado-tracks/map" element={<TornadoTracks />} />
      <Route path="/projects/route2gpx" element={<Route2Gpx />} />
      <Route path="/projects/aborg" element={<Aborg />} />
      <Route path="/projects/parc" element={<Parc />} />
      <Route path="/projects/status-dashboard" element={<StatusDashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function PageContent() {
  const location = useLocation();
  useLayoutEffect(() => intentPrefetch.cancelPending(), [location.key]);
  return (
    <Layout>
      <RouteOrientation />
      <MapPerformance />
      <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<LoadingFallback />}>
          <AppRoutes />
          <span hidden data-route-path={location.pathname} />
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <Router basename={basename}>
      <ScrollToTop />
      <PageContent />
    </Router>
  );
}
