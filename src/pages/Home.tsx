import { Link } from 'react-router-dom';
import { featuredProjects } from '../content/projects';

function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function Home() {
  return (
    <div className="space-y-12">
      {/* Intro */}
      <section>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-4">
          Hey, I'm Robby
        </h1>
        <div className="prose">
          <p>
            I'm a developer who likes building interactive things on the web.
            I'm particularly interested in data visualization, maps, and 
            tools that help people explore information in new ways.
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
            const linkUrl = project.demoUrl || `/projects/${project.slug}`;
            const isExternal = isExternalUrl(linkUrl);
            const linkProps = {
              className: "group block p-4 -mx-4 rounded-lg hover:bg-zinc-900/50 transition-colors"
            };
            
            const content = (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400">
                    {project.title}
                    {isExternal && <span className="text-zinc-600 ml-1">↗</span>}
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
                {isExternal ? (
                  <a href={linkUrl} target="_blank" rel="noopener noreferrer" {...linkProps}>
                    {content}
                  </a>
                ) : (
                  <Link to={linkUrl} {...linkProps}>
                    {content}
                  </Link>
                )}
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
