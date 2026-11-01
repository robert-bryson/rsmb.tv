import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { atlasTableColumns, type AtlasTableColumnId, type AtlasTableColumnSetting } from './tripAtlasTableColumns';

interface Reorder {
    id: AtlasTableColumnId;
    initial: AtlasTableColumnSetting[];
    order: AtlasTableColumnSetting[];
    pointer?: { id: number; startX: number; startY: number; y: number; offset: number; height: number; moved: boolean };
}

export function TripAtlasColumnChoices({ columns, onChange }: {
    columns: AtlasTableColumnSetting[];
    onChange: (columns: AtlasTableColumnSetting[]) => void;
}) {
    const list = useRef<HTMLOListElement>(null);
    const reorder = useRef<Reorder | null>(null);
    const frame = useRef(0);
    const restoreFocus = useRef<{ id: AtlasTableColumnId; scroll: boolean } | null>(null);
    const [active, setActive] = useState<AtlasTableColumnId | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const instructions = useId();
    const name = (id: AtlasTableColumnId) => atlasTableColumns.find(column => column.id === id)!.name;
    const rowFor = (id: AtlasTableColumnId) => list.current?.querySelector<HTMLElement>(`[data-column-id="${id}"]`);

    const move = (current: Reorder, index: number) => {
        const from = current.order.findIndex(column => column.id === current.id);
        const to = Math.max(1, Math.min(current.order.length - 1, index));
        if (from === to) return;
        const next = [...current.order];
        next.splice(to, 0, ...next.splice(from, 1));
        current.order = next;
        onChange(next);
        setAnnouncement(`${name(current.id)}, column ${to + 1} of ${next.length}.`);
    };

    const paintDrag = (current: Reorder) => {
        const element = list.current;
        const row = rowFor(current.id);
        const pointer = current.pointer;
        if (!element || !row || !pointer?.moved) return;
        // offsetTop ignores the transform, keeping the row under the pointer as siblings move.
        const bounds = element.getBoundingClientRect();
        const top = bounds.top + row.offsetTop - element.scrollTop;
        const dragTop = Math.max(bounds.top, Math.min(pointer.y - pointer.offset, bounds.bottom - pointer.height));
        row.style.setProperty('--atlas-column-drag-offset', `${dragTop - top}px`);
    };

    const updateDrag = () => {
        const current = reorder.current;
        const element = list.current;
        if (!current?.pointer?.moved || !element) return;
        const bounds = element.getBoundingClientRect();
        const { pointer } = current;
        const edge = Math.min(36, bounds.height / 3);
        const speed = pointer.y < bounds.top + edge ? -Math.min(10, (bounds.top + edge - pointer.y) / 3)
            : pointer.y > bounds.bottom - edge ? Math.min(10, (pointer.y - bounds.bottom + edge) / 3) : 0;
        element.scrollTop += speed;
        const center = Math.max(bounds.top + pointer.height / 2, Math.min(pointer.y - pointer.offset + pointer.height / 2, bounds.bottom - pointer.height / 2));
        const before = [...element.children].filter((child): child is HTMLElement => child instanceof HTMLElement
            && child.dataset.columnId !== 'trip' && child.dataset.columnId !== current.id)
            .filter(child => bounds.top + child.offsetTop - element.scrollTop + child.offsetHeight / 2 < center).length;
        move(current, before + 1);
        paintDrag(current);
    };

    const tick = () => {
        updateDrag();
        if (reorder.current?.pointer?.moved) frame.current = requestAnimationFrame(tick);
    };

    const finish = (cancelled = false, focus = true) => {
        if (!cancelled) updateDrag();
        const current = reorder.current;
        if (!current) return;
        reorder.current = null;
        cancelAnimationFrame(frame.current);
        rowFor(current.id)?.style.removeProperty('--atlas-column-drag-offset');
        if (cancelled) onChange(current.initial);
        if (current.pointer && list.current?.hasPointerCapture(current.pointer.id)) list.current.releasePointerCapture(current.pointer.id);
        restoreFocus.current = focus ? { id: current.id, scroll: !current.pointer } : null;
        setActive(null);
        const order = cancelled ? current.initial : current.order;
        setAnnouncement(cancelled ? `${name(current.id)} move cancelled. Original order restored.`
            : `${name(current.id)} placed at column ${order.findIndex(column => column.id === current.id) + 1} of ${order.length}.`);
    };

    useEffect(() => () => { cancelAnimationFrame(frame.current); }, []);
    useLayoutEffect(() => {
        const focus = restoreFocus.current ?? (active ? { id: active, scroll: !reorder.current?.pointer } : null);
        if (focus) {
            const handle = rowFor(focus.id)?.querySelector('button');
            handle?.focus({ preventScroll: true });
            if (focus.scroll) handle?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            restoreFocus.current = null;
        }
        if (reorder.current) paintDrag(reorder.current);
    });

    const pickUp = (id: AtlasTableColumnId) => {
        if (reorder.current) { finish(); return; }
        reorder.current = { id, initial: columns, order: columns };
        setActive(id);
        setAnnouncement(`${name(id)} picked up. Use Up and Down to move, Space to drop, or Escape to cancel.`);
    };

    const keyDown = (event: KeyboardEvent<HTMLButtonElement>, id: AtlasTableColumnId) => {
        const current = reorder.current;
        if (event.key === 'Escape' && current) {
            event.preventDefault();
            event.stopPropagation();
            finish(true);
        } else if ([' ', 'Enter'].includes(event.key)) {
            event.preventDefault();
            if (!current?.pointer) pickUp(id);
        } else if (current && !current.pointer && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const index = current.order.findIndex(column => column.id === current.id);
            move(current, event.key === 'Home' ? 1 : event.key === 'End' ? current.order.length - 1 : index + (event.key === 'ArrowUp' ? -1 : 1));
        } else if (event.key === 'Tab' && current && !current.pointer) finish(false, false);
    };

    const pointerDown = (event: PointerEvent<HTMLButtonElement>, id: AtlasTableColumnId) => {
        if (!event.isPrimary || event.button !== 0 || !list.current) return;
        if (reorder.current) finish();
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        const row = event.currentTarget.closest('li')!.getBoundingClientRect();
        reorder.current = { id, initial: columns, order: columns, pointer: {
            id: event.pointerId, startX: event.clientX, startY: event.clientY, y: event.clientY,
            offset: event.clientY - row.top, height: row.height, moved: false,
        } };
        // Capture on the stable list: moving keyed rows must not interrupt a touch drag.
        list.current.setPointerCapture(event.pointerId);
    };

    const pointerMove = (event: PointerEvent<HTMLOListElement>) => {
        const current = reorder.current;
        const pointer = current?.pointer;
        if (!pointer || pointer.id !== event.pointerId) return;
        const moved = pointer.moved || Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >= 5;
        reorder.current = { ...current, pointer: { ...pointer, y: event.clientY, moved } };
        if (!pointer.moved && moved) {
            setActive(current.id);
            frame.current = requestAnimationFrame(tick);
        }
        if (moved) event.preventDefault();
    };

    return <>
        <p id={instructions} className="sr-only">Drag to reorder columns. With a keyboard, press Space to pick up, use Up and Down or Home and End to move, then Space to drop or Escape to cancel. Trip stays first.</p>
        <ol ref={list} className="atlas-column-choices min-h-0 space-y-1 overflow-y-auto overscroll-contain"
            onPointerMove={pointerMove}
            onPointerUp={event => { if (reorder.current?.pointer?.id === event.pointerId) finish(); }}
            onPointerCancel={event => { if (reorder.current?.pointer?.id === event.pointerId) finish(true); }}
            onLostPointerCapture={event => { if (reorder.current?.pointer?.id === event.pointerId) finish(true); }}>
            {columns.map(setting => {
                const columnName = name(setting.id);
                return <li key={setting.id} data-column-id={setting.id} data-reordering={active === setting.id || undefined}
                    className="atlas-column-choice flex items-center gap-2">
                    <label data-atlas-tooltip={setting.id === 'trip' ? 'Trip names always stay visible and first while scrolling.' : undefined}
                        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                        <input id={`atlas-column-${setting.id}`} type="checkbox" checked={setting.visible} disabled={setting.id === 'trip'}
                            aria-label={`Show ${columnName} column`} className="size-4 shrink-0 accent-violet-400"
                            onChange={event => onChange(columns.map(item => item.id === setting.id ? { ...item, visible: event.target.checked } : item))} />
                        <span>{columnName}</span>
                    </label>
                    {setting.id === 'trip' ? <span className="atlas-column-pin" role="img" aria-label="Trip column is pinned"
                        data-atlas-tooltip="Trip names stay pinned as the first column.">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                    </span> : <button type="button" aria-label={`Reorder ${columnName} column`} aria-describedby={instructions}
                        aria-pressed={active === setting.id}
                        data-atlas-tooltip={active === setting.id ? undefined : `Drag to reorder ${columnName}. Or press Space, use Up and Down, then Space to drop; Escape cancels.`}
                        className="atlas-control atlas-icon-control atlas-column-grip"
                        onPointerDown={event => pointerDown(event, setting.id)} onKeyDown={event => keyDown(event, setting.id)}
                        onBlur={event => { if (event.relatedTarget && reorder.current && !reorder.current.pointer) finish(false, false); }}
                        onClick={event => { if (event.detail === 0) pickUp(setting.id); }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                        </svg>
                    </button>}
                </li>;
            })}
        </ol>
        <p role="status" className="sr-only">{announcement}</p>
    </>;
}
