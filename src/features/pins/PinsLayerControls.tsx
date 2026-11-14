import { useEffect, useId, useRef, useState } from 'react';
import type { CountyMode } from './geometry';

interface Props {
    geography: 'us' | 'world' | 'country';
    circles: boolean;
    countyMode: CountyMode;
    showCounties: boolean;
    showRegions: boolean;
    selected: boolean;
    navigationHint: string | null;
    onCirclesChange: (visible: boolean) => void;
    onCountyModeChange: (mode: CountyMode) => void;
    onRegionsChange: (visible: boolean) => void;
}

/** Secondary display controls share one disclosure inside the fullscreen frame. */
export function PinsLayerControls(props: Props) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const toggle = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    useEffect(() => {
        if (!open) return;
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.repeat || event.defaultPrevented || event.target instanceof HTMLSelectElement) return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            toggle.current?.focus({ preventScroll: true });
        };
        const outside = (event: PointerEvent) => {
            if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('keydown', escape, true);
        document.addEventListener('pointerdown', outside);
        return () => {
            document.removeEventListener('keydown', escape, true);
            document.removeEventListener('pointerdown', outside);
        };
    }, [open]);
    return <div className={`pins-layers${open ? ' is-open' : ''}`} ref={root}>
        <button type="button" className="pins-layers-toggle" ref={toggle} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />
            </svg>
            Map layers <span className="pins-layers-chevron" aria-hidden="true" />
        </button>
        <div className="pins-layer-options" id={panelId} hidden={!open}>
            <div className="pins-layer-group">
                <label className="pins-circle-toggle"><input type="checkbox" checked={props.circles} onChange={event => props.onCirclesChange(event.target.checked)} /><span>All radius circles</span></label>
                <p>{props.selected ? 'The selected circle and distances stay visible.' : props.geography === 'us' ? 'Larger counties reveal detail earlier. Zoom in for smaller counties.' : 'Distances appear as you zoom in.'}</p>
            </div>
            {props.geography === 'country' && <div className="pins-layer-group">
                <label className="pins-circle-toggle"><input type="checkbox" checked={props.showRegions} onChange={event => props.onRegionsChange(event.target.checked)} /><span>States & provinces</span></label>
                <p>Show regional pins and boundaries.</p>
            </div>}
            {props.geography === 'us' && <fieldset className="pins-layer-group">
                <legend>County layer</legend>
                <div className="pins-segments">{(['off', 'auto', 'on'] as const).map(mode => <button type="button" key={mode} aria-pressed={props.countyMode === mode} onClick={() => props.onCountyModeChange(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
                <p aria-live="polite">{props.countyMode === 'auto' ? props.showCounties ? 'County pins visible' : 'Zoom in to show counties.' : props.countyMode === 'on' ? 'County pins always visible' : 'County pins hidden'}</p>
            </fieldset>}
            <div className="pins-map-legend" role="group" aria-label="Map symbols">
                {props.selected ? <><span><i className="pins-selected-dot" />Selected pin</span><span><i className="pins-context-dot" />Other pins · selectable</span></>
                    : <><span><i className="pins-national-dot" />{props.geography === 'us' ? 'U.S. pole' : 'Country poles'}</span>
                        {props.geography !== 'world' && <span><i className="pins-state-dot" />{props.geography === 'us' ? 'States & territories' : 'States & provinces'}</span>}
                        {props.geography === 'us' && <span><i className="pins-county-dot" />Counties</span>}</>}
                <span className="pins-legend-circle"><i />Radius to nearest edge</span>
            </div>
            <p className="pins-display-help">{props.navigationHint && <>{props.navigationHint}<br /></>}Click the current location above to recenter. Select a pin for all boundary distances.</p>
        </div>
    </div>;
}
