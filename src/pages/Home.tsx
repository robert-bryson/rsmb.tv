import { IntentLink } from '../components/IntentLink';
import { ProjectPreview } from '../components/ProjectPreview';
import { featuredProjects } from '../content/projects';
import { getAllPosts } from '../content/posts';
import { getTripSummary } from '../features/trips/tripSummaries';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { formatDate } from '../utils/formatDate';

const selectedProjects = featuredProjects.slice(0, 3);

export function Home() {
  const recentPosts = getAllPosts().slice(0, 3);

  usePageMetadata(staticPageMetadata('/'));

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
          <IntentLink to="/projects" className="text-sm text-zinc-400 hover:text-violet-400">
            All projects →
          </IntentLink>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {selectedProjects.map((project, index) => {
            const linkUrl = `/projects/${project.slug}`;

            return (
              <li key={project.slug} className={`min-w-0 ${index === 0 ? 'sm:col-span-2' : ''}`}>
                <IntentLink
                  prefetchMode="destination" to={linkUrl}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
                >
                  {project.previewImage && (
                    <ProjectPreview
                      src={project.previewImage}
                      alt=""
                      className="aspect-video w-full border-b border-zinc-800 object-cover"
                      priority={index === 0}
                      sizes={index === 0 ? '(min-width: 768px) 720px, calc(100vw - 3rem)' : '(min-width: 768px) 352px, (min-width: 640px) calc(50vw - 2rem), calc(100vw - 3rem)'}
                    />
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-baseline justify-between gap-4">
                      <h3 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400">
                        {project.title}
                      </h3>
                      <span className="shrink-0 text-sm text-zinc-400">{project.year}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      {project.summary ?? project.description}
                    </p>
                    <ul className="mt-auto flex flex-wrap gap-x-2 gap-y-1 pt-3" aria-label="Technologies">
                      {project.tech.slice(0, 3).map((technology) => (
                        <li key={technology} className="text-xs text-zinc-400">
                          {technology}
                        </li>
                      ))}
                    </ul>
                  </div>
                </IntentLink>
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
            <IntentLink to="/posts" className="text-sm text-zinc-400 hover:text-violet-400">
              All posts →
            </IntentLink>
          </div>
          <ul className="divide-y divide-zinc-800/70">
            {recentPosts.map((post) => {
              const isTrip = post.format === 'trip';
              const manifest = isTrip ? getTripSummary(post.tripId) : undefined;
              const hero = manifest?.hero;

              return (
                <li key={post.slug} className="py-5 first:pt-0 last:pb-0">
                  <IntentLink prefetchMode="destination" to={`/${isTrip ? 'trips' : 'blog'}/${post.slug}`} className="group flex items-start gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
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
                        sizes="(min-width: 640px) 128px, 96px"
                        width={hero.width}
                        height={hero.height}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] w-24 sm:w-32 shrink-0 rounded-md border border-zinc-800 object-cover"
                      />
                    )}
                  </IntentLink>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}
