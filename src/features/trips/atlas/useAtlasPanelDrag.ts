import { useEffect, useEffectEvent, useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import type { AtlasPanelState } from './tripAtlasBrowser';

interface Drag {
    pointerId: number;
    target: HTMLElement;
    root: HTMLElement;
    vertical: boolean;
    start: number;
    size: number;
    compact: number;
    expanded: number;
    initialState: AtlasPanelState;
    state: AtlasPanelState;
    moved: boolean;
}

function clearDrag(root: HTMLElement) {
    delete root.dataset.panelDragging;
    root.style.removeProperty('--atlas-drag-size');
    root.style.removeProperty('--atlas-drag-compact-size');
}

export function useAtlasPanelDrag(drawer: RefObject<HTMLDivElement | null>, state: AtlasPanelState, onState: (state: AtlasPanelState) => void) {
    const drag = useRef<Drag | null>(null);
    const suppressClick = useRef(false);

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        const element = drawer.current;
        const root = element?.closest<HTMLElement>('.atlas-explorer');
        if (!element || !root) return;
        const vertical = window.matchMedia('(width < 768px)').matches;
        const dimension = vertical ? 'height' : 'width';
        const size = state === 'collapsed' ? 0 : element.getBoundingClientRect()[dimension];
        // Resolve the CSS snap sizes against the drawer's actual containing block.
        const previous = element.style[dimension];
        element.style.setProperty(dimension, `var(--atlas-compact-${dimension})`);
        const compact = element.getBoundingClientRect()[dimension];
        element.style.setProperty(dimension, `var(--atlas-expanded-${dimension})`);
        const expanded = element.getBoundingClientRect()[dimension];
        if (previous) element.style.setProperty(dimension, previous);
        else element.style.removeProperty(dimension);
        const target = (event.target as Element).closest('button') ?? event.currentTarget;
        suppressClick.current = false;
        drag.current = {
            pointerId: event.pointerId, target, root, vertical,
            start: vertical ? event.clientY : event.clientX, size, compact, expanded,
            initialState: state, state, moved: false,
        };
        // Capture on the button so an ordinary press still produces its native click.
        target.focus({ preventScroll: true });
        target.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const delta = current.vertical ? current.start - event.clientY : event.clientX - current.start;
        if (!current.moved && Math.abs(delta) < 6) return;
        current.moved = true;
        event.preventDefault();
        const size = Math.max(0, Math.min(current.expanded, current.size + delta));
        const next: AtlasPanelState = size < current.compact / 2 ? 'collapsed'
            : size < (current.compact + current.expanded) / 2 ? 'compact' : 'expanded';
        if (next !== current.state) {
            current.state = next;
            onState(next);
        }
        current.root.style.setProperty('--atlas-drag-compact-size', `${current.compact}px`);
        current.root.style.setProperty('--atlas-drag-size', `${size}px`);
        current.root.dataset.panelDragging = '';
    };

    const finish = (cancelled = false) => {
        const current = drag.current;
        if (!current) return;
        drag.current = null;
        suppressClick.current = current.moved;
        if (cancelled && current.moved) onState(current.initialState);
        clearDrag(current.root);
        if (current.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
    };

    const cancel = useEffectEvent(() => finish(true));
    useEffect(() => {
        // Safari can leave pointer-pressed buttons unfocused. Escape must still cancel the drag.
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || !drag.current) return;
            event.preventDefault();
            event.stopPropagation();
            cancel();
        };
        // A drag's orientation and snap sizes are valid only in its original layout.
        document.addEventListener('keydown', escape, true);
        window.addEventListener('resize', cancel);
        window.addEventListener('blur', cancel);
        return () => {
            document.removeEventListener('keydown', escape, true);
            window.removeEventListener('resize', cancel);
            window.removeEventListener('blur', cancel);
            const current = drag.current;
            if (!current) return;
            drag.current = null;
            clearDrag(current.root);
            if (current.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
        };
    }, []);

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp: (event: PointerEvent<HTMLDivElement>) => { if (drag.current?.pointerId === event.pointerId) finish(); },
        onPointerCancel: (event: PointerEvent<HTMLDivElement>) => { if (drag.current?.pointerId === event.pointerId) finish(true); },
        onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => { if (drag.current?.pointerId === event.pointerId) finish(); },
        onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
            if (suppressClick.current && event.detail !== 0) {
                suppressClick.current = false;
                event.preventDefault();
                event.stopPropagation();
            }
        },
    };
}
