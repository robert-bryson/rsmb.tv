import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

/** Fill the viewport even when the browser rejects or lacks native fullscreen. */
export function usePanelFullscreen<Panel extends string>() {
    const container = useRef<HTMLElement>(null);
    const opener = useRef<HTMLButtonElement>(null);
    const wantsFullscreen = useRef(false);
    const previousScroll = useRef<number | null>(null);
    const [expanded, setExpanded] = useState<Panel | null>(null);

    function restorePanel() {
        wantsFullscreen.current = false;
        setExpanded(null);
        opener.current?.focus({ preventScroll: true });
    }

    function exitNative(target: HTMLElement | null) {
        if (target && document.fullscreenElement === target) void document.exitFullscreen().catch(() => {});
    }

    function toggleFullscreen(panel: Panel, button: HTMLButtonElement) {
        const target = container.current;
        if (expanded === panel) {
            restorePanel();
            exitNative(target);
            return;
        }

        opener.current = button;
        previousScroll.current = target?.scrollTop ?? 0;
        wantsFullscreen.current = true;
        setExpanded(panel);
        void target?.requestFullscreen?.().then(() => {
            if (!wantsFullscreen.current) exitNative(target);
        }).catch(() => {});
    }

    const onEscape = useEffectEvent((event: KeyboardEvent) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !expanded) return;
        restorePanel();
        exitNative(container.current);
    });
    const onNativeExit = useEffectEvent(() => { if (expanded) restorePanel(); });

    useLayoutEffect(() => {
        const target = container.current;
        if (!target || previousScroll.current === null) return;
        target.scrollTop = expanded ? 0 : previousScroll.current;
        if (!expanded) previousScroll.current = null;
    }, [expanded]);

    useEffect(() => {
        const target = container.current;
        let native = false;
        function fullscreenChanged() {
            const active = target !== null && document.fullscreenElement === target;
            if (native && !active) onNativeExit();
            native = active;
        }
        function keyPressed(event: KeyboardEvent) { onEscape(event); }
        document.addEventListener('fullscreenchange', fullscreenChanged);
        document.addEventListener('keydown', keyPressed);
        return () => {
            wantsFullscreen.current = false;
            document.removeEventListener('fullscreenchange', fullscreenChanged);
            document.removeEventListener('keydown', keyPressed);
            exitNative(target);
        };
    }, []);

    return { container, expanded, fullscreenButton: opener, toggleFullscreen };
}
