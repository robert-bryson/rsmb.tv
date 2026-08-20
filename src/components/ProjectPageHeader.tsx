import type { ReactNode } from 'react';

interface ProjectHeaderAction {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
  external?: boolean;
}

interface ProjectPageHeaderProps {
  title: string;
  stack: string;
  description: ReactNode;
  actions: ProjectHeaderAction[];
}

export function ProjectPageHeader({ title, stack, description, actions }: ProjectPageHeaderProps) {
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
                target="_blank"
                rel="noopener noreferrer"
                className={baseClassName}
              >
                {action.label}
              </a>
            );
          }

          return (
            <a key={`${action.label}-${action.href}`} href={action.href} className={baseClassName}>
              {action.label}
            </a>
          );
        })}
      </div>
    </>
  );
}
