import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import type { FC } from 'react';


import Layout from './components/Layout';

import Home from './pages/Home';
const About = lazy(() => import('./pages/About') as Promise<{ default: FC }>);
const Projects = lazy(() => import('./pages/Projects') as Promise<{ default: FC }>);
const Flights = lazy(() => import('./pages/Flights') as Promise<{ default: FC }>);
const Blog = lazy(() => import('./pages/Blog') as Promise<{ default: FC }>);


export default function App() {
  useEffect(() => {
    document.title = "rsmb.tv";
  }, []);

  return (
    <Router>
      <Layout>
        <Suspense fallback={<div className='text-white p-4'>Loading...</div>}>
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

