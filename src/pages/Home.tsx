import { Link } from 'react-router-dom';
import { featuredProjects } from '../content/projects';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';

export function Home() {
  useDocumentHead({
    title: 'rsmb',
    description: 'Personal site and portfolio of Robby Bryson — interactive data visualizations, geospatial projects, and web tools.',
    ogImage: 'https://rsmb.tv/og/home.svg',
  });

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'rsmb',
    url: 'https://rsmb.tv',
    author: {
      '@type': 'Person',
      name: 'Robby Bryson',
      url: 'https://rsmb.tv',
    },
  });

  return (
    <div className="space-y-12">
      {/* Intro */}
      <section>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-4">
          Hi, I'm Robby
        </h1>
        <div className="prose">
          <p>
            I'm a developer who likes building maps and apps and interactive ways to see the world.
          </p>
        </div>
      </section>

      {/* Featured Work */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-4">
          Featured
        </h2>
        <ul className="space-y-4">
          {featuredProjects.map((project) => {
            const linkUrl = `/projects/${project.slug}`;
            const linkProps = {
              className: "group block p-4 -mx-4 rounded-lg hover:bg-zinc-900/50 transition-colors"
            };

            const content = (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400">
                    {project.title}
                  </h3>
                  <span className="text-sm text-zinc-600">{project.year}</span>
                </div>
                <p className="mt-1 text-zinc-400 text-sm">
                  {project.description}
                </p>
                <div className="mt-2 flex gap-2">
                  {project.tech.slice(0, 3).map((t) => (
                    <span key={t} className="text-xs text-zinc-600">
                      {t}
                    </span>
                  ))}
                </div>
              </>
            );

            return (
              <li key={project.slug}>
                <Link to={linkUrl} {...linkProps}>
                  {content}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-6">
          <Link
            to="/projects"
            className="text-sm text-zinc-500 hover:text-violet-400"
          >
            View all projects →
          </Link>
        </div>
      </section>
    </div>
  );
}
