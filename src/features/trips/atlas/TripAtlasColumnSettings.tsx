import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defaultAtlasTableColumns, type AtlasTableColumnSetting } from './tripAtlasTableColumns';
import { TripAtlasColumnChoices } from './TripAtlasColumnChoices';

export function TripAtlasColumnSettings({ columns, onChange }: {
    columns: AtlasTableColumnSetting[];
    onChange: (columns: AtlasTableColumnSetting[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [placement, setPlacement] = useState({ container: null as HTMLElement | null, top: 0, left: 0, width: 320, maxHeight: 420 });
    const container = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLElement>(null);
    const pointerInside = useRef(false);
    const reservedSpace = useRef<{ shell: HTMLElement; previous: string } | null>(null);
    const close = useCallback(() => { setOpen(false); button.current?.focus({ preventScroll: true }); }, []);
    const containsTarget = useCallback((target: EventTarget | null) => target instanceof Node
        && Boolean(container.current?.contains(target) || panel.current?.contains(target)), []);
    useEffect(() => {
        if (!open) return;
        const first = panel.current?.querySelector<HTMLInputElement>('input:not(:disabled)');
        first?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        first?.focus({ preventScroll: true });
        const outside = (event: PointerEvent) => {
            pointerInside.current = containsTarget(event.target);
            if (!pointerInside.current) setOpen(false);
        };
        const release = () => { pointerInside.current = false; };
        // Safari can leave focus on the body after an inside click. Observe its next focus destination too.
        const focus = (event: FocusEvent) => { if (!containsTarget(event.target)) setOpen(false); };
        const dismiss = () => setOpen(false);
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
        const resize = () => close();
        document.addEventListener('pointerdown', outside);
        document.addEventListener('pointerup', release);
        document.addEventListener('pointercancel', release);
        document.addEventListener('focusin', focus);
        document.addEventListener('keydown', escape);
        window.addEventListener('blur', dismiss);
        window.addEventListener('resize', resize);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('pointerup', release);
            document.removeEventListener('pointercancel', release);
            document.removeEventListener('focusin', focus);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('blur', dismiss);
            window.removeEventListener('resize', resize);
            pointerInside.current = false;
            const reserved = reservedSpace.current;
            if (reserved) {
                if (reserved.previous) reserved.shell.style.setProperty('min-height', reserved.previous);
                else reserved.shell.style.removeProperty('min-height');
                reservedSpace.current = null;
            }
        };
    }, [open, close, containsTarget]);

    return <div ref={container} className="atlas-column-settings" onBlur={event => {
        // A null target can mean document exit or Safari's default blur during an inside pointer click.
        if (event.relatedTarget ? !containsTarget(event.relatedTarget) : !pointerInside.current) setOpen(false);
    }}>
        <button ref={button} type="button" aria-label="Customize table columns"
            data-atlas-tooltip={open ? 'Close column settings. Changes are saved automatically.' : 'Show or hide table columns, change their order, or restore defaults.'}
            aria-expanded={open} aria-controls="atlas-column-settings" aria-haspopup="dialog" className="atlas-control atlas-icon-control"
            onClick={event => {
                const list = event.currentTarget.closest<HTMLElement>('#atlas-trip-list');
                const bounds = list?.getBoundingClientRect();
                const shell = event.currentTarget.closest<HTMLElement>('.atlas-table-shell');
                if (!open && list && bounds && shell) {
                    // Keep the editor usable when chips or notices sit above a short table.
                    reservedSpace.current = { shell, previous: shell.style.minHeight };
                    shell.style.setProperty('min-height', `${Math.max(shell.offsetHeight, list.clientHeight - 24)}px`);
                    list.scrollTop += event.currentTarget.getBoundingClientRect().top - bounds.top - 12;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                const root = event.currentTarget.closest<HTMLElement>('.atlas-explorer') ?? document.body;
                const tripPanel = event.currentTarget.closest<HTMLElement>('#atlas-trip-panel')?.getBoundingClientRect();
                // Short sheets need an overlay outside the results list's clipping boundary.
                const available = bounds && bounds.height >= 320 ? bounds
                    : tripPanel && tripPanel.height >= 320 ? tripPanel : root.getBoundingClientRect();
                const below = available.bottom - rect.bottom - 8;
                const above = rect.top - available.top - 8;
                const flip = below < 320 && above > below;
                const maxHeight = Math.min(420, available.height - 24);
                const top = Math.max(available.top + 12,
                    Math.min(flip ? rect.top - maxHeight - 4 : rect.bottom + 4, available.bottom - maxHeight - 12));
                const width = Math.min(320, available.width - 24);
                const left = Math.max(available.left + 12, Math.min(rect.right - width, available.right - width - 12));
                setPlacement({ container: root, top, left, width, maxHeight });
                setOpen(current => !current);
            }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" />
            </svg>
        </button>
        {open && placement.container && createPortal(<section ref={panel} id="atlas-column-settings" role="dialog" aria-label="Table columns"
            data-atlas-map-obstacle className="atlas-column-options atlas-surface"
            style={{ top: placement.top, left: placement.left, width: placement.width, maxHeight: placement.maxHeight }}>
            <div className="flex shrink-0 items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Columns</h3>
                <button type="button" aria-label="Close column settings" data-atlas-tooltip="Close column settings. Your changes are saved automatically." onClick={close} className="atlas-control atlas-icon-control">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
            </div>
            <p className="mb-2 shrink-0 text-xs text-zinc-400">{columns.filter(column => column.visible).length} of {columns.length} columns visible. Trip stays first.<br />Drag handles to reorder.</p>
            <TripAtlasColumnChoices columns={columns} onChange={onChange} />
            <button type="button" data-atlas-tooltip="Show every column in its original order." onClick={() => onChange(defaultAtlasTableColumns())} className="atlas-control mt-3 w-full shrink-0 px-3">Reset columns</button>
        </section>, placement.container)}
    </div>;
}
