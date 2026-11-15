import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { usePostFilterPosition } from '../hooks/usePostFilterPosition';

export function PostFilters({ count, children }: { count: number; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const dismissForViewport = useCallback(() => {
        if (panel.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
        setOpen(false);
    }, []);
    usePostFilterPosition(open, container, panel, dismissForViewport);

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
                trigger.current?.focus();
            }
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', dismissWithEscape);
        return () => {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', dismissWithEscape);
        };
    }, [open]);

    return <div ref={container} className="relative shrink-0"
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} aria-describedby={`${id}-count`}
            onClick={() => setOpen(value => !value)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm transition-colors ${count
                ? 'border-violet-500/50 text-violet-300 hover:border-violet-400'
                : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="size-4">
                <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />
            </svg>
            Filters
            {count > 0 && <span aria-hidden="true" className="rounded-full bg-violet-500/15 px-1.5 text-xs tabular-nums">{count}</span>}
        </button>
        <span id={`${id}-count`} className="sr-only">{count
            ? `${count} active ${count === 1 ? 'filter' : 'filters'}`
            : 'Filter by tag or region'}</span>
        <div ref={panel} id={id} hidden={!open} role="region" aria-label="Post filters" tabIndex={-1}
            className="post-filter-panel absolute right-0 z-30 w-[min(42rem,calc(100vw-3rem))] space-y-5 overflow-y-auto overscroll-contain rounded-lg border border-zinc-700/80 bg-[#111111] shadow-xl">
            {open && children}
        </div>
    </div>;
}
