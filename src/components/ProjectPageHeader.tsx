import { IntentLink } from './IntentLink';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { trackAnalyticsEvent } from '../utils/analytics';

interface ProjectHeaderAction {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
  external?: boolean;
  analyticsDestination?: 'data';
}

interface ProjectPageHeaderProps {
  title: string;
  stack: string;
  description: ReactNode;
  actions: ProjectHeaderAction[];
}

export function ProjectPageHeader({ title, stack, description, actions }: ProjectPageHeaderProps) {
  const project = useLocation().pathname.split('/')[2];
  const trackAction = (action: ProjectHeaderAction) => trackAnalyticsEvent('project-link-click', {
    project, destination: action.analyticsDestination ?? (action.href.startsWith('https://github.com/') ? 'source' : 'demo'), placement: 'project-header',
  });
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-100">{title}</h1>
      <p className="mb-6 text-sm text-zinc-400">{stack}</p>

      <p className="mb-6 leading-relaxed text-zinc-300">{description}</p>

      <div className="mb-8 flex flex-wrap gap-3">
        {actions.map((action) => {
          const isPrimary = action.variant === 'primary';
          const baseClassName = isPrimary
            ? 'inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500'
            : 'inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700';

          if (action.external) {
            return (
              <a
                key={`${action.label}-${action.href}`}
                href={action.href}
                onClick={() => trackAction(action)}
                target="_blank"
                rel="noopener noreferrer"
                className={baseClassName}
              >
                {action.label}
              </a>
            );
          }

          return (
            <IntentLink prefetchMode="destination" key={`${action.label}-${action.href}`} to={action.href} className={baseClassName} onClick={() => trackAction(action)}>
              {action.label}
            </IntentLink>
          );
        })}
      </div>
    </>
  );
}
