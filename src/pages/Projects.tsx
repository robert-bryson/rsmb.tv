import { useId, useRef } from 'react';
import { IntentLink } from '../components/IntentLink';
import { TechBadges } from '../components/TechBadges';
import { ProjectPreview } from '../components/ProjectPreview';
import { projects, projectCategories, formatProjectDate, type Project, type ProjectCategory } from '../content/projects';
import { createProjectsUrl, filterProjects, getProjectCategory } from '../content/projectFilters';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { staticPageMetadata } from '../utils/pageMetadata';
import { trackAnalyticsEvent } from '../utils/analytics';

const categories: Array<{ value: ProjectCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All projects' },
  ...Object.entries(projectCategories).map(([value, label]) => ({ value: value as ProjectCategory, label })),
];

export function Projects() {
  usePageMetadata(staticPageMetadata('/projects'));
  const { query, clearFilters, searchParams } = useSearchQuery();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const categoryCountsId = useId();
  const category = getProjectCategory(searchParams.get('category'));
  const matchingProjects = filterProjects(projects, { query });
  const visibleProjects = filterProjects(matchingProjects, { category });
  const hasFilters = category !== 'all' || Boolean(query);

  return (
    <div>
      <h1 ref={titleRef} tabIndex={-1} className="page-title mb-2">Projects</h1>
      <p className="mb-8 text-zinc-400">
        Maps, data explorations, and tools I've built. Find something to explore or use.
      </p>

      <nav aria-label="Project categories" className="mb-5 flex flex-wrap gap-2">
        {categories.map(({ value, label }) => {
          const count = value === 'all' ? matchingProjects.length : matchingProjects.filter(project => project.category === value).length;
          return <IntentLink key={value} to={createProjectsUrl({ category: value, query })} preventScrollReset
            aria-describedby={`${categoryCountsId}-${value}`}
            aria-current={category === value ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${category === value
              ? 'border-violet-400/60 bg-violet-400/10 text-violet-200'
              : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200'}`}
          >
            {label}<span id={`${categoryCountsId}-${value}`} aria-hidden="true" className="text-xs tabular-nums">
              {count}{' '}<span className="sr-only">{count === 1 ? 'matching project' : 'matching projects'}</span>
            </span>
          </IntentLink>;
        })}
      </nav>

      <div className="mb-6 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-zinc-800/70 pb-3">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-zinc-400">
          {visibleProjects.length !== projects.length && `${visibleProjects.length} of `}
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          {query && <> matching “{query}”</>}
        </p>
        {hasFilters && <button type="button" className="min-h-11 rounded-md px-2 text-sm text-violet-300 hover:underline"
          onClick={() => { clearFilters(); titleRef.current?.focus(); }}
        >Clear all filters</button>}
      </div>

      {visibleProjects.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-10 text-center">
          <h2 className="font-medium text-zinc-200">{projects.length ? 'No projects match these filters.' : 'No projects yet.'}</h2>
          {projects.length > 0 && <p className="mt-2 text-sm text-zinc-400">Try another keyword or clear the filters to see all projects.</p>}
        </div>
      ) : (
        <ul aria-label="Projects" className="space-y-4">
          {visibleProjects.map((project, index) => (
            <li key={project.slug} className="rounded-xl border border-zinc-800 bg-zinc-900/20">
              <IntentLink prefetchMode="destination" to={`/projects/${project.slug}`}
                onClick={() => trackProjectLink(project, 'details')}
                className="group flex flex-col items-start gap-4 rounded-t-xl p-4 transition-colors hover:bg-zinc-900/60 sm:flex-row sm:gap-5"
              >
                <ProjectContent project={project} priority={index === 0} />
              </IntentLink>
              {(project.demoUrl || project.sourceUrl) && (
                <div className="flex flex-wrap items-center gap-x-5 border-t border-zinc-800/70 px-4">
                  {project.demoUrl && <ProjectAction project={project} destination="demo" href={project.demoUrl}>
                    {project.demoUrl.startsWith('/') ? 'Open map' : 'Live demo'}
                  </ProjectAction>}
                  {project.sourceUrl && <ProjectAction project={project} destination="source" href={project.sourceUrl}>Source</ProjectAction>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function trackProjectLink(project: Project, destination: 'details' | 'demo' | 'source') {
  trackAnalyticsEvent('project-link-click', { project: project.slug, destination, placement: 'projects' });
}

function ProjectAction({ project, destination, href, children }: {
  project: Project;
  destination: 'demo' | 'source';
  href: string;
  children: string;
}) {
  const className = 'inline-flex min-h-11 items-center gap-1.5 text-sm text-violet-300 hover:text-violet-200 hover:underline';
  const label = `${children}: ${project.title}`;
  if (href.startsWith('/')) {
    return <IntentLink to={href} prefetchMode="destination" aria-label={label} className={className}
      onClick={() => trackProjectLink(project, destination)}>{children}<span aria-hidden="true">→</span></IntentLink>;
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`}
    className={className} onClick={() => trackProjectLink(project, destination)}
  >{children}<span aria-hidden="true">↗</span></a>;
}

function ProjectContent({ project, priority }: { project: Project; priority: boolean }) {
  return (
    <>
      {project.previewImage && (
        <ProjectPreview src={project.previewImage} alt="" priority={priority}
          className="aspect-video w-full shrink-0 rounded-md border border-zinc-800 object-cover sm:w-48"
          sizes="(min-width: 640px) 192px, calc(100vw - 5rem)" />
      )}
      <div className="w-full min-w-0 flex-1 wrap-anywhere">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400">{project.title}</h2>
          <span className="text-xs text-zinc-400">
            {project.lastUpdated ? <>Updated <time dateTime={project.lastUpdated}>{formatProjectDate(project)}</time></> : project.year}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-zinc-400">{project.summary ?? project.description}</p>
        <TechBadges tech={project.tech} className="mt-3" />
      </div>
    </>
  );
}
