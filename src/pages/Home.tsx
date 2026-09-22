import { Link } from 'react-router-dom';
import { featuredProjects } from '../content/projects';
import { getAllPosts } from '../content/posts';
import { getTripHero, getTripManifest } from '../features/trips';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, SITE_URL, absoluteUrl } from '../utils/siteMetadata';

const selectedProjects = featuredProjects.slice(0, 3);

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
      <section>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-4">
          Hi, I'm Robby
        </h1>
        <div className="prose">
          <p>
            I build maps, data visualizations, and tools for exploring the world.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
            Selected projects
          </h2>
          <Link to="/projects" className="text-sm text-zinc-500 hover:text-violet-400">
            All projects →
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {selectedProjects.map((project, index) => {
            const linkUrl = `/projects/${project.slug}`;

            return (
              <li key={project.slug} className={`min-w-0 ${index === 0 ? 'sm:col-span-2' : ''}`}>
                <Link
                  to={linkUrl}
                  className={`group grid h-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60 ${index === 0 ? 'sm:grid-cols-[minmax(0,1.45fr)_minmax(15rem,1fr)]' : ''}`}
                >
                  {project.previewImage && (
                    <img
                      src={project.previewImage}
                      alt=""
                      className={`aspect-video h-full w-full object-cover ${index === 0 ? 'border-b border-zinc-800 sm:border-r sm:border-b-0' : 'border-b border-zinc-800'}`}
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
              Latest
            </h2>
            <Link to="/posts" className="text-sm text-zinc-500 hover:text-violet-400">
              All posts →
            </Link>
          </div>
          <ul className="divide-y divide-zinc-800/70">
            {recentPosts.map((post) => {
              const isTrip = post.format === 'trip';
              const manifest = isTrip ? getTripManifest(post.tripId) : undefined;
              const hero = manifest ? getTripHero(manifest) : undefined;

              return (
                <li key={post.slug} className="py-5 first:pt-0 last:pb-0">
                  <Link to={`/${isTrip ? 'trips' : 'blog'}/${post.slug}`} className="group flex items-start gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                        <time dateTime={post.date}>{formatDate(post.date)}</time>
                        <span className="text-xs uppercase">{isTrip ? 'Trip report' : 'Writing'}</span>
                      </div>
                      <h3 className="mt-1 text-lg font-medium leading-snug text-zinc-100 group-hover:text-violet-400">
                        {post.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">{post.description}</p>
                    </div>
                    {hero && (
                      <img
                        src={hero.src}
                        srcSet={hero.srcSet}
                        sizes="128px"
                        width={hero.width}
                        height={hero.height}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="hidden aspect-[4/3] w-32 shrink-0 rounded-md border border-zinc-800 object-cover sm:block"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}
