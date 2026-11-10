import { IntentLink } from '../components/IntentLink';
import { TechBadges } from '../components/TechBadges';
import { ProjectPreview } from '../components/ProjectPreview';
import { projects, formatProjectDate, type Project } from '../content/projects';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { trackAnalyticsEvent } from '../utils/analytics';

export function Projects() {
  usePageMetadata(staticPageMetadata('/projects'));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Projects</h1>
      <p className="text-zinc-400 mb-8">
        Things I've built, mostly for fun.
      </p>

      <ul className="space-y-6">
        {projects.map((project, index) => (
          <li key={project.slug}>
            <IntentLink prefetchMode="destination"
              to={`/projects/${project.slug}`}
              onClick={() => trackAnalyticsEvent('project-link-click', { project: project.slug, destination: 'details', placement: 'projects' })}
              className="group block p-4 -mx-4 rounded-lg hover:bg-zinc-900/50 transition-colors"
            >
              <ProjectContent project={project} priority={index === 0} />
            </IntentLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectContent({ project, priority }: { project: Project; priority: boolean }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h2 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400">
          {project.title}
        </h2>
        <span className="text-sm text-zinc-400 whitespace-nowrap">
          {project.lastUpdated ? (
            <>Updated <time dateTime={project.lastUpdated}>{formatProjectDate(project)}</time></>
          ) : project.year}
        </span>
      </div>
      {project.previewImage && (
        <ProjectPreview
          src={project.previewImage}
          alt={`${project.title} preview`}
          className="mb-3 aspect-video w-full rounded-md border border-zinc-800 object-cover"
          priority={priority}
          sizes="(min-width: 768px) 720px, calc(100vw - 3rem)"
        />
      )}
      <p className="mt-1 text-zinc-400 text-sm leading-relaxed">
        {project.description}
      </p>
      <TechBadges tech={project.tech} className="mt-3" />
      <div className="mt-3 flex gap-4 text-xs">
        {project.demoUrl && (
          <span className="text-violet-400">Live demo</span>
        )}
        {project.sourceUrl && (
          <span className="text-zinc-400">Source</span>
        )}
      </div>
    </>
  );
}
