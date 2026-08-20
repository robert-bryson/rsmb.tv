import { Link } from 'react-router-dom';
import { featuredProjects } from '../content/projects';
import { getAllPosts } from '../content/posts';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, SITE_URL, absoluteUrl } from '../utils/siteMetadata';

export function Home() {
  const recentPosts = getAllPosts().slice(0, 3);

  useDocumentHead({
    title: 'rsmb',
    description: 'Personal site and portfolio of Robby Bryson — interactive data visualizations, geospatial projects, and web tools.',
    ogImage: absoluteUrl('/og/home.svg'),
  });

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'rsmb',
    url: SITE_URL,
    author: AUTHOR_PERSON,
  });

  return (
    <div className="space-y-14">
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

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
            Projects
          </h2>
          <Link to="/projects" className="text-sm text-zinc-500 hover:text-violet-400">
            View all projects →
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {featuredProjects.map((project, index) => {
            const linkUrl = `/projects/${project.slug}`;

            return (
              <li key={project.slug} className="min-w-0">
                <Link
                  to={linkUrl}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
                >
                  {project.previewImage && (
                    <img
                      src={project.previewImage}
                      alt=""
                      className="aspect-video w-full border-b border-zinc-800 object-cover"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                    />
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-baseline justify-between gap-4">
                      <h3 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400">
                        {project.title}
                      </h3>
                      <span className="shrink-0 text-sm text-zinc-500">{project.year}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      {project.summary ?? project.description}
                    </p>
                    <ul className="mt-auto flex flex-wrap gap-x-2 gap-y-1 pt-3" aria-label="Technologies">
                      {project.tech.slice(0, 3).map((technology) => (
                        <li key={technology} className="text-xs text-zinc-500">
                          {technology}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {recentPosts.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
              Writing
            </h2>
            <Link to="/blog" className="text-sm text-zinc-500 hover:text-violet-400">
              View all writing →
            </Link>
          </div>
          <ul className="space-y-5">
            {recentPosts.map((post) => (
              <li key={post.slug}>
                <Link to={`/blog/${post.slug}`} className="group block">
                  <div className="flex items-baseline gap-3">
                    <time className="text-sm text-zinc-500 shrink-0">{formatDate(post.date)}</time>
                    <span className="min-w-0 break-words text-zinc-100 group-hover:text-violet-400 font-medium leading-snug">
                      {post.title}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm mt-1 ml-0">{post.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
