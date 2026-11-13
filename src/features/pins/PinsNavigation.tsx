import type { RefObject } from 'react';
import { pinScopeName, type PinBreadcrumb, type PinScope } from './navigation';

interface Props {
    trail: PinBreadcrumb[];
    parent: PinScope | null;
    worldRef: RefObject<HTMLButtonElement | null>;
    upRef: RefObject<HTMLButtonElement | null>;
    onNavigate: (scope: PinScope) => void;
    onUp: () => void;
}

export function PinsNavigation({ trail, parent, worldRef, upRef, onNavigate, onUp }: Props) {
    return <>
        <nav className="pins-location" aria-label="Map location">
            <ol>{trail.map((crumb, index) => <li key={`${index}:${crumb.label}`}>
                {index === 0 ? <button type="button" ref={worldRef} aria-label="World overview" aria-current={trail.length === 1 ? 'location' : undefined}
                    onClick={() => onNavigate(crumb.scope)}>{crumb.label}</button>
                    : index === trail.length - 1 ? <span className="pins-crumb-label" aria-current="location">{crumb.label}</span>
                        : <button type="button" onClick={() => onNavigate(crumb.scope)}>{crumb.label}</button>}
            </li>)}</ol>
        </nav>
        {parent && <button type="button" className="pins-button pins-up" ref={upRef} aria-label={`Up one level: ${pinScopeName(parent)}`} onClick={onUp}>
            <span aria-hidden="true">↑</span> Up one level
        </button>}
        <p className="sr-only" role="status">Map view: {trail.map(crumb => crumb.label).join(', ')}.</p>
    </>;
}
