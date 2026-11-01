import { useCallback, useEffect, useRef, useState } from 'react';
import { atlasSortOptions, type AtlasSort } from './tripAtlasBrowser';

export function TripAtlasSort({ value, onChange }: { value: AtlasSort; onChange: (sort: AtlasSort) => void }) {
    const [open, setOpen] = useState(false);
    const [maxHeight, setMaxHeight] = useState(320);
    const container = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const close = useCallback(() => { setOpen(false); button.current?.focus({ preventScroll: true }); }, []);
    useEffect(() => {
        if (!open) return;
        const checked = container.current?.querySelector<HTMLInputElement>('input:checked');
        checked?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        checked?.focus({ preventScroll: true });
        const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
        const resize = () => setOpen(false);
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        window.addEventListener('resize', resize);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('resize', resize);
        };
    }, [open, close]);

    return <div ref={container} className="atlas-sort-control" onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
        <button ref={button} type="button" aria-label="Sort trips" aria-expanded={open} aria-controls="atlas-sort-options"
            data-atlas-tooltip={`${open ? 'Close sorting choices' : 'Choose how trips are ordered'}. Current order: ${atlasSortOptions.find(option => option.value === value)?.label}.`}
            className="atlas-control atlas-icon-control" onClick={event => {
                const bottom = event.currentTarget.closest('.atlas-panel')?.getBoundingClientRect().bottom ?? window.innerHeight;
                setMaxHeight(Math.max(44, bottom - event.currentTarget.getBoundingClientRect().bottom - 12));
                setOpen(current => !current);
            }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 4v16m-4-4 4 4 4-4M17 20V4m-4 4 4-4 4 4" />
            </svg>
        </button>
        {open && <fieldset id="atlas-sort-options" className="atlas-sort-options atlas-surface" style={{ maxHeight: Math.min(320, maxHeight) }}>
            <legend className="sr-only">Sort trips</legend>
            {atlasSortOptions.map(option => <label key={option.value}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm ${value === option.value ? 'bg-violet-950 text-violet-200' : 'hover:bg-zinc-800'}`}>
                <input type="radio" name="atlas-sort" value={option.value} checked={value === option.value} className="accent-violet-400"
                    onChange={() => { onChange(option.value); close(); }} />
                {option.label}
            </label>)}
        </fieldset>}
    </div>;
}
