import { Link } from 'react-router-dom';
import { featuredProjects } from '../content/projects';
import { getAllPosts } from '../content/posts';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, SITE_URL } from '../utils/siteMetadata';

export function Home() {
  const recentPosts = getAllPosts().slice(0, 3);

  useDocumentHead({
    title: 'rsmb',
    description: 'Personal site and portfolio of Robby Bryson — interactive data visualizations, geospatial projects, and web tools.',
    ogImage: 'https://rsmb.tv/og/home.svg',
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
            View all →
          </Link>
        </div>
        <ul className="space-y-4">
          {featuredProjects.map((project) => {
            const linkUrl = `/projects/${project.slug}`;
            const linkProps = {
              className: "group block p-4 -mx-4 rounded-lg hover:bg-zinc-900/50 transition-colors"
            };

            const content = (
              <>
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400">
                    {project.title}
                  </h3>
                  <span className="text-sm text-zinc-500">{project.year}</span>
                </div>
                {project.previewImage && (
                  <img
                    src={project.previewImage}
                    alt={`${project.title} preview`}
                    className="mb-3 aspect-video w-full rounded-md border border-zinc-800 object-cover"
                    loading="lazy"
                  />
                )}
                <p className="mt-1 text-zinc-400 text-sm">
                  {project.description}
                </p>
                <div className="mt-2 flex gap-2">
                  {project.tech.slice(0, 3).map((t) => (
                    <span key={t} className="text-xs text-zinc-500">
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
      </section>

      {recentPosts.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
              Writing
            </h2>
            <Link to="/blog" className="text-sm text-zinc-500 hover:text-violet-400">
              View all →
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
