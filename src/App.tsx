import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { Home, About, Projects, Blog } from './pages';

const Flights = lazy(() => import('./pages/Flights'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-gray-400">Loading...</div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    document.title = 'rsmb.tv';
  }, []);

  return (
    <Router>
      <Layout>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/flights" element={<Flights />} />
            <Route path="/blog" element={<Blog />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

