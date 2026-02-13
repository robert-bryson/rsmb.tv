import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { Home, About, Projects } from './pages';

const Flights = lazy(() => import('./pages/Flights'));
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
      <Layout>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/flights" element={<Flights />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

