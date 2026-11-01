import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';

interface ActiveTooltip { target: HTMLElement; text: string }

/** One tooltip layer serves React controls and native MapLibre buttons, including fullscreen. */
export function AtlasControlTooltips({ container }: { container: RefObject<HTMLElement | null> }) {
    const [active, setActive] = useState<ActiveTooltip | null>(null);
    const popup = useRef<HTMLDivElement>(null);
    const id = useId();
    useEffect(() => {
        const root = container.current;
        if (!root) return;
        let hoverTimer: ReturnType<typeof setTimeout> | undefined;
        let pointerTimer: ReturnType<typeof setTimeout> | undefined;
        let pointerFocus = false;
        let touchFocus = false;
        let visible = false;
        let current: ActiveTooltip | null = null;
        let focused: HTMLElement | null = null;
        let scrollFrame = 0;
        const targetFor = (node: EventTarget | null) => node instanceof Element ? node.closest<HTMLElement>('[data-atlas-tooltip]') : null;
        const hide = () => {
            clearTimeout(hoverTimer);
            if (scrollFrame) cancelAnimationFrame(scrollFrame);
            focused = null;
            current = null;
            if (visible) { visible = false; setActive(null); }
        };
        const show = (target: HTMLElement) => {
            const text = target.dataset.atlasTooltip;
            if (target.isConnected && text && !root.hasAttribute('data-panel-dragging')) {
                visible = true;
                current = { target, text };
                setActive(current);
            }
        };
        const over = (event: PointerEvent) => {
            // Scrolling a focused control into view can move another control under a stationary pointer.
            if (event.pointerType === 'touch' || pointerFocus || focused?.contains(document.activeElement)) return;
            const target = targetFor(event.target);
            if (!target || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return;
            hide();
            hoverTimer = setTimeout(() => {
                const hit = document.elementFromPoint(event.clientX, event.clientY);
                if (hit && target.contains(hit)) show(target);
            }, 250);
        };
        const out = (event: PointerEvent) => {
            if (focused?.contains(document.activeElement)) return;
            const target = targetFor(event.target);
            if (target && !(event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) hide();
        };
        const focus = (event: FocusEvent) => {
            hide();
            const target = targetFor(event.target);
            if (!pointerFocus && !touchFocus && target) { focused = target; show(target); }
        };
        const blur = (event: FocusEvent) => {
            if (targetFor(event.target) !== targetFor(event.relatedTarget)) hide();
        };
        const down = (event: PointerEvent) => { pointerFocus = true; touchFocus = event.pointerType === 'touch'; hide(); };
        // Focus and hover may arrive before native scrolling has settled.
        const scroll = () => {
            if (focused?.contains(document.activeElement)) {
                if (scrollFrame) cancelAnimationFrame(scrollFrame);
                scrollFrame = requestAnimationFrame(() => {
                    scrollFrame = 0;
                    if (!focused) return;
                    const box = focused.getBoundingClientRect();
                    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
                    if (hit && focused.contains(hit)) show(focused);
                    else hide();
                });
            } else if (visible) hide();
        };
        const up = () => { clearTimeout(pointerTimer); pointerTimer = setTimeout(() => { pointerFocus = false; }, 0); };
        const key = (event: KeyboardEvent) => {
            pointerFocus = false;
            touchFocus = false;
            if (['Escape', 'Enter', ' '].includes(event.key)) hide();
            // A closing popover returns focus synchronously; Escape should dismiss its hint too.
            if (event.key === 'Escape') { pointerFocus = true; up(); }
        };
        // History changes can update a focused control, and renderer retries can remove it.
        const observer = new MutationObserver(() => {
            const target = current?.target;
            if (!target) return;
            if (!root.contains(target) || target.closest('[hidden], [inert], [aria-hidden="true"]')
                || root.hasAttribute('data-panel-dragging') || !target.dataset.atlasTooltip) hide();
            else if (target.dataset.atlasTooltip !== current?.text) show(target);
        });
        observer.observe(root, {
            subtree: true, childList: true, attributes: true,
            attributeFilter: ['data-atlas-tooltip', 'data-panel-dragging', 'hidden', 'inert', 'aria-hidden'],
        });
        root.addEventListener('pointerover', over, true);
        root.addEventListener('pointerout', out, true);
        root.addEventListener('focusin', focus);
        root.addEventListener('focusout', blur);
        root.addEventListener('pointerdown', down, true);
        root.addEventListener('keydown', key);
        root.addEventListener('scroll', scroll, true);
        document.addEventListener('pointerup', up, true);
        document.addEventListener('pointercancel', up, true);
        document.addEventListener('fullscreenchange', hide);
        window.addEventListener('resize', hide);
        window.addEventListener('blur', hide);
        return () => {
            observer.disconnect();
            clearTimeout(hoverTimer);
            clearTimeout(pointerTimer);
            if (scrollFrame) cancelAnimationFrame(scrollFrame);
            root.removeEventListener('pointerover', over, true);
            root.removeEventListener('pointerout', out, true);
            root.removeEventListener('focusin', focus);
            root.removeEventListener('focusout', blur);
            root.removeEventListener('pointerdown', down, true);
            root.removeEventListener('keydown', key);
            root.removeEventListener('scroll', scroll, true);
            document.removeEventListener('pointerup', up, true);
            document.removeEventListener('pointercancel', up, true);
            document.removeEventListener('fullscreenchange', hide);
            window.removeEventListener('resize', hide);
            window.removeEventListener('blur', hide);
        };
    }, [container]);

    useLayoutEffect(() => {
        const element = popup.current;
        const root = container.current;
        if (!active || !element || !root) return;
        const bounds = root.getBoundingClientRect();
        const anchor = active.target.getBoundingClientRect();
        element.style.setProperty('max-width', `${Math.max(16, Math.min(320, bounds.width - 16))}px`);
        const size = element.getBoundingClientRect();
        const left = Math.max(bounds.left + 8, Math.min(anchor.left + (anchor.width - size.width) / 2, bounds.right - size.width - 8));
        const below = anchor.bottom + 8;
        const top = Math.max(bounds.top + 8, Math.min(below + size.height <= bounds.bottom - 8 ? below : anchor.top - size.height - 8, bounds.bottom - size.height - 8));
        element.style.setProperty('left', `${left}px`);
        element.style.setProperty('top', `${top}px`);
        element.style.setProperty('visibility', 'visible');
        const descriptions = new Set((active.target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
        descriptions.add(id);
        active.target.setAttribute('aria-describedby', [...descriptions].join(' '));
        return () => {
            const remaining = (active.target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(value => value && value !== id);
            if (remaining.length) active.target.setAttribute('aria-describedby', remaining.join(' '));
            else active.target.removeAttribute('aria-describedby');
        };
    }, [active, container, id]);

    return active && <div ref={popup} id={id} role="tooltip" data-testid="atlas-control-tooltip" data-atlas-map-obstacle
        className="atlas-control-tooltip">{active.text}</div>;
}
