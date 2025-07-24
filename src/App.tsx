import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useEffect } from 'react';

const Layout = ({ children }) => (
  <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
    <header className="bg-gray-800 p-4 shadow-md">
      <nav className="container mx-auto flex justify-between">
        <h1 className="text-xl font-bold text-purple-300">My Portfolio</h1>
        <ul className="flex gap-4 text-sm">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/about">About</Link></li>
          <li><Link to="/projects">Projects</Link></li>
          <li><Link to="/blog">Blog</Link></li>
        </ul>
      </nav>
    </header>
    <main className="container mx-auto py-8 px-4">
      {children}
    </main>
    <footer className="bg-gray-800 text-center py-4 text-xs text-gray-400">
      &copy; {new Date().getFullYear()} My Portfolio
    </footer>
  </div>
);

const Home = () => (
  <section className="text-center">
    <h2 className="text-3xl font-semibold text-purple-200 mb-4">Welcome</h2>
    <p>This is a simple, clean portfolio site built with React.</p>
  </section>
);

const About = () => (
  <section>
    <h2 className="text-2xl font-semibold text-blue-200 mb-2">About Me</h2>
    <p>I’m a developer who enjoys building clean and maintainable systems.</p>
  </section>
);

const Projects = () => (
  <section>
    <h2 className="text-2xl font-semibold text-purple-200 mb-2">Projects</h2>
    <ul className="list-disc pl-5">
      <li>Project 1 – Description</li>
      <li>Project 2 – Description</li>
    </ul>
  </section>
);

const Blog = () => (
  <section>
    <h2 className="text-2xl font-semibold text-blue-200 mb-2">Blog</h2>
    <p>Coming soon...</p>
  </section>
);

export default function App() {
  useEffect(() => {
    document.title = "My Portfolio";
  }, []);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/blog" element={<Blog />} />
        </Routes>
      </Layout>
    </Router>
  );
}

