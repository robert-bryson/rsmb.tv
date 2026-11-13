import { useState } from 'react';
import type { CountyMode } from './geometry';

interface Props {
    geography: 'us' | 'world' | 'country';
    circles: boolean;
    countyMode: CountyMode;
    showCounties: boolean;
    showRegions: boolean;
    selected: boolean;
    onCirclesChange: (visible: boolean) => void;
    onCountyModeChange: (mode: CountyMode) => void;
    onRegionsChange: (visible: boolean) => void;
}

/** Keep display settings in the map frame, including native fullscreen. */
export function PinsLayerControls(props: Props) {
    const [open, setOpen] = useState(() => window.innerWidth >= 768 && window.innerHeight >= 600);
    return <details className="pins-layers" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
        <summary>
            <span className="pins-layers-title">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                    <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />
                </svg>
                Map layers
            </span>
            <span className="pins-layers-state" aria-hidden="true">{open ? 'Hide controls' : 'Show controls'}<span className="pins-layers-chevron" /></span>
        </summary>
        <div className={`pins-layer-options${props.geography === 'world' ? ' is-world' : ''}`}>
            <div className="pins-layer-group">
                <label className="pins-circle-toggle"><input type="checkbox" checked={props.circles} onChange={event => props.onCirclesChange(event.target.checked)} /><span>All radius circles</span></label>
                <p className="pins-radius-hint">{props.selected ? 'The selected circle and distances stay visible.' : 'Distances appear as you zoom in.'}</p>
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
        </div>
    </details>;
}
