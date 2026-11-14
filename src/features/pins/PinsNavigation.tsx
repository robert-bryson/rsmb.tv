import type { RefObject } from 'react';
import { pinScopeName, type PinBreadcrumb, type PinScope } from './navigation';

interface Props {
    trail: PinBreadcrumb[];
    parent: PinScope | null;
    worldRef: RefObject<HTMLButtonElement | null>;
    upRef: RefObject<HTMLButtonElement | null>;
    onNavigate: (scope: PinScope) => void;
    onUp: () => void;
    onRecenter: () => void;
}

export function PinsNavigation({ trail, parent, worldRef, upRef, onNavigate, onUp, onRecenter }: Props) {
    return <>
        <div className="pins-location-bar">
            {parent && <button type="button" className="pins-up" ref={upRef} aria-label={`Up one level: ${pinScopeName(parent)}`} title={`Up one level: ${pinScopeName(parent)} (Esc)`} onClick={onUp}>
                <span aria-hidden="true">↑</span>
            </button>}
            <nav className="pins-location" aria-label="Map location">
                <ol>{trail.map((crumb, index) => <li key={`${index}:${crumb.label}`}>
                    {index === 0 ? <button type="button" ref={worldRef} aria-label="World overview" aria-current={trail.length === 1 ? 'location' : undefined}
                        onClick={() => onNavigate(crumb.scope)}>{crumb.label}</button>
                        : index === trail.length - 1 ? <button type="button" title={`Recenter ${crumb.label}`} aria-current="location" onClick={onRecenter}>{crumb.label}</button>
                            : <button type="button" title={crumb.label} onClick={() => onNavigate(crumb.scope)}>{crumb.label}</button>}
                </li>)}</ol>
            </nav>
        </div>
        <p className="sr-only" role="status">Map view: {trail.map(crumb => crumb.label).join(', ')}.</p>
    </>;
}
