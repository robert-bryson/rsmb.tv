import { useEffect, useRef, type Ref } from 'react';
import { Link, useHref, type LinkProps } from 'react-router-dom';
import { intentPrefetch } from '../navigation/intentPrefetch';
import { resolvePrefetchTarget, type PrefetchMode } from '../navigation/prefetchTargets';

interface Props extends LinkProps { prefetchMode?: PrefetchMode; ref?: Ref<HTMLAnchorElement> }

/** Keep native/router link behavior; preparation only responds to sustained intent. */
export function IntentLink({ prefetchMode = 'page', onPointerEnter, onPointerLeave, onPointerDown,
    onFocus, onBlur, onClick, ...props }: Props) {
    const routerHref = useHref(props.to, { relative: props.relative });
    const href = typeof props.to === 'string' && /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(props.to) ? props.to : routerHref;
    const intent = useRef({ hover: false, focus: false, touch: false, cancel: undefined as (() => void) | undefined });
    useEffect(() => {
        const state = intent.current;
        const cancel = () => { state.cancel?.(); state.cancel = undefined; state.hover = state.focus = false; };
        const visibility = () => { if (document.visibilityState === 'hidden') cancel(); };
        document.addEventListener('visibilitychange', visibility);
        return () => { cancel(); document.removeEventListener('visibilitychange', visibility); };
    }, [href, prefetchMode, props.download, props.reloadDocument, props.target]);

    const update = () => {
        const state = intent.current;
        if (!state.hover && !state.focus) { state.cancel?.(); state.cancel = undefined; return; }
        if (state.cancel || state.touch || prefetchMode === 'none' || props.download !== undefined || props.reloadDocument || (props.target && props.target !== '_self')) return;
        const target = resolvePrefetchTarget(href, window.location.href);
        if (target) state.cancel = intentPrefetch.schedule(target, prefetchMode);
    };

    return <Link {...props}
        onPointerEnter={event => {
            onPointerEnter?.(event);
            if (event.defaultPrevented || event.pointerType === 'touch') return;
            intent.current.hover = true; intent.current.touch = false; update();
        }}
        onPointerLeave={event => {
            onPointerLeave?.(event);
            if (event.defaultPrevented) return;
            intent.current.hover = false; update();
        }}
        onPointerDown={event => {
            onPointerDown?.(event);
            if (event.defaultPrevented) return;
            intent.current.touch = event.pointerType === 'touch';
            if (intent.current.touch) { intent.current.hover = intent.current.focus = false; update(); }
        }}
        onFocus={event => {
            onFocus?.(event);
            if (event.defaultPrevented || intent.current.touch) return;
            intent.current.focus = true; update();
        }}
        onBlur={event => {
            onBlur?.(event);
            if (event.defaultPrevented) return;
            intent.current.focus = false; intent.current.touch = false; update();
        }}
        onClick={event => {
            onClick?.(event);
            if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
                && (!props.target || props.target === '_self')) intentPrefetch.cancelPending();
        }}
    />;
}
