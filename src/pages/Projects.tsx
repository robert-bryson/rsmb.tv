import { Link } from 'react-router-dom';
import { projects } from '../content/projects';

function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function Projects() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Projects</h1>
      <p className="text-zinc-500 mb-8">
        Things I've built, mostly for fun.
      </p>
      
      <ul className="space-y-6">
        {projects.map((project) => {
          const linkUrl = project.demoUrl || project.sourceUrl;
          const isExternal = linkUrl && isExternalUrl(linkUrl);
          
          if (linkUrl && isExternal) {
            return (
              <li key={project.slug}>
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block p-4 -mx-4 rounded-lg hover:bg-zinc-900/50 transition-colors"
                >
                  <ProjectContent project={project} />
                </a>
              </li>
            );
          }
          
          if (linkUrl) {
            return (
              <li key={project.slug}>
                <Link
                  to={linkUrl}
                  className="group block p-4 -mx-4 rounded-lg hover:bg-zinc-900/50 transition-colors"
                >
                  <ProjectContent project={project} />
                </Link>
              </li>
            );
          }
          
          return (
            <li key={project.slug}>
              <div className="p-4 -mx-4">
                <ProjectContent project={project} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProjectContent({ project }: { project: typeof projects[0] }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400">
          {project.title}
        </h2>
        <span className="text-sm text-zinc-600">{project.year}</span>
      </div>
      <p className="mt-1 text-zinc-400 text-sm leading-relaxed">
        {project.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {project.tech.map((t) => (
          <span 
            key={t} 
            className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs">
        {project.demoUrl && (
          <span className="text-violet-400">View demo →</span>
        )}
        {project.sourceUrl && (
          <span className="text-zinc-500">Source ↗</span>
        )}
      </div>
    </>
  );
}
