import { useEffect, useId, useRef, useState } from 'react';
import { IntentLink } from '../IntentLink';
import { projects } from '../../content/projects';

export function ProjectsNavigation({ pathname, active }: { pathname: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLLIElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setOpen(false);
      if (container.current?.contains(document.activeElement)) {
        event.preventDefault();
        event.stopPropagation();
        toggle.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismissWithEscape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismissWithEscape);
    };
  }, [open]);

  return (
    <li ref={container} className="relative"
      onPointerEnter={event => { if (event.pointerType !== 'touch') setOpen(true); }}
      onPointerLeave={() => { if (!container.current?.contains(document.activeElement)) setOpen(false); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    >
      <div className="flex items-center">
        <IntentLink to="/projects" aria-current={active ? pathname === '/projects' ? 'page' : 'location' : undefined}
          className={`inline-flex min-h-11 items-center hover:text-violet-400 ${active ? 'text-violet-400' : 'text-zinc-400'}`}>
          Projects
        </IntentLink>
        <button ref={toggle} type="button" aria-label="Project pages" aria-expanded={open} aria-controls={id}
          onClick={() => setOpen(value => !value)}
          className="grid min-h-11 min-w-8 place-items-center rounded text-zinc-400 hover:text-violet-300">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d={open ? 'm3 7 3-3 3 3' : 'm3 5 3 3 3-3'} />
          </svg>
        </button>
      </div>
      <div id={id} hidden={!open} className="absolute right-0 top-full z-50 min-w-52 pt-1">
        <ul aria-label="Project pages" className="max-h-[70dvh] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-lg">
          {projects.map(project => {
            const to = `/projects/${project.slug}`;
            const selected = pathname === to || pathname.startsWith(`${to}/`);
            return <li key={project.slug}>
              <IntentLink to={to} aria-current={selected ? pathname === to ? 'page' : 'location' : undefined}
                className={`flex min-h-11 items-center truncate px-4 hover:bg-zinc-800/60 hover:text-violet-400 ${selected ? 'bg-zinc-800/70 text-violet-300' : 'text-zinc-400'}`}>
                {project.title}
              </IntentLink>
            </li>;
          })}
        </ul>
      </div>
    </li>
  );
}
