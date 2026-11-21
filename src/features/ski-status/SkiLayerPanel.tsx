import { useId, useLayoutEffect, useRef } from 'react';
import type { SkiUnits } from './browse';
import { markerLegend, markerModes, passBadgeTextColor, type MarkerMode } from './mapAppearance';
import { skiRunLegend, skiTerrainLegend, type TerrainConvention } from './resortTerrainData';
import { snowDepthAnalysis, snowDepthBands } from './skiMapOverlays';
import { SkiIconButton } from './SkiIcon';
import { SkiPassIcon } from './SkiPassIcon';

export type SetSkiLayer = (key: 'color' | 'terrain' | 'skiTerrain' | 'snowDepth', value?: string) => void;

interface Props {
    colors: MarkerMode;
    units: SkiUnits;
    indyDiscounts: boolean;
    terrain: boolean;
    snowDepth: boolean;
    resortTerrain: boolean;
    conventions: readonly TerrainConvention[];
    onChange: SetSkiLayer;
    onClose: () => void;
}

function LayerToggle({ label, note, checked, onChange }: {
    label: string; note?: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
    const description = useId();
    return <label className="ski-layer-toggle">
        <span>{label}{note && <span id={description} className="ski-layer-note">{note}</span>}</span>
        <input type="checkbox" checked={checked} aria-label={label} aria-describedby={note ? description : undefined}
            onChange={event => onChange(event.target.checked)} />
    </label>;
}

export function SkiLayerPanel({ colors, units, indyDiscounts, terrain, snowDepth, resortTerrain, conventions, onChange, onClose }: Props) {
    const markerSelect = useRef<HTMLSelectElement>(null);
    useLayoutEffect(() => { markerSelect.current?.focus(); }, []);
    const legend = markerLegend(colors, units, indyDiscounts);
    return <section id="ski-map-layers" className="ski-layer-panel" role="dialog" aria-labelledby="ski-map-layers-title">
        <div className="ski-layer-heading">
            <h2 id="ski-map-layers-title">Map layers</h2>
            <SkiIconButton className="ski-quiet-button" icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="ski-layer-content">
            <div className="ski-layer-markers">
                <label htmlFor="ski-marker-color">Map markers</label>
                <select ref={markerSelect} id="ski-marker-color" className="ski-input" value={colors}
                    onChange={event => onChange('color', event.target.value)}>
                    {Object.entries(markerModes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                {legend.length > 0 && <ul aria-label="Resort map key" className="ski-layer-key-list">
                    {legend.map(({ color, label, family, multiple, glyph }) => <li key={label}>
                        {family ? <SkiPassIcon family={family} size={20} />
                            : multiple ? <span aria-hidden="true" className="grid size-5 place-items-center rounded-full font-bold"
                                style={{ backgroundColor: color, color: passBadgeTextColor }}>+</span>
                            : <span aria-hidden="true" className={glyph ? 'w-4 text-center font-bold' : 'size-2.5 rounded-full'}
                                style={glyph ? { color } : { backgroundColor: color }}>{glyph}</span>}{label}
                    </li>)}
                </ul>}
            </div>
            <fieldset className="ski-layer-overlays">
                <legend>Overlays</legend>
                <LayerToggle label="Terrain relief" checked={terrain} onChange={checked => onChange('terrain', checked ? '1' : '0')} />
                <LayerToggle label="Ski terrain" checked={resortTerrain} onChange={checked => onChange('skiTerrain', checked ? undefined : '0')} />
                <LayerToggle label="Snow depth" note="Contiguous U.S." checked={snowDepth}
                    onChange={checked => onChange('snowDepth', checked ? '1' : undefined)} />
            </fieldset>
            {snowDepth && <SnowDepthKey units={units} />}
            {conventions.length > 0 && <TerrainKey conventions={conventions} />}
        </div>
    </section>;
}

function SnowDepthKey({ units }: { units: SkiUnits }) {
    const metric = units === 'metric';
    const unit = metric ? 'cm' : 'in';
    const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: metric ? 1 : 2 });
    const depth = (inches: number) => number.format(metric ? inches * 2.54 : inches);
    return <section aria-labelledby="ski-snow-depth-key" className="ski-layer-key">
        <h3 id="ski-snow-depth-key">Estimated snow depth ({unit})</h3>
        <ul aria-label={`Snow depth color scale (${unit})`} className="ski-layer-key-list ski-snow-depth-key">
            {snowDepthBands.map(([min, max, color]) => <li key={min}>
                <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: color }} />{depth(min)}–{depth(max)}
            </li>)}
        </ul>
        <p className="ski-layer-note">
            Clear areas show less than {depth(snowDepthBands[0][0])} {unit} or no data. <a href={snowDepthAnalysis}>NOAA source</a>
        </p>
    </section>;
}

const conventionLabels: Record<TerrainConvention, string> = { default: 'Green and blue convention', europe: 'European convention', japan: 'Japanese convention' };

function TerrainLines({ entries }: { entries: readonly { label: string; color: string; dashed?: boolean }[] }) {
    return <ul className="ski-layer-key-list">
        {entries.map(({ label, color, dashed }) => <li key={label}>
            <span aria-hidden="true" className="w-5 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid',
                filter: color === '#18181b' ? 'drop-shadow(0 0 1px white)' : undefined }} />{label}
        </li>)}
    </ul>;
}

function TerrainKey({ conventions }: { conventions: readonly TerrainConvention[] }) {
    return <section aria-labelledby="ski-terrain-key-title" className="ski-layer-key">
        <h3 id="ski-terrain-key-title">Mapped runs and lifts</h3>
        {conventions.map(convention => <div key={convention} className="space-y-1">
            <p className="ski-layer-note">{conventionLabels[convention]}</p>
            <TerrainLines entries={skiRunLegend(convention)} />
        </div>)}
        <TerrainLines entries={skiTerrainLegend} />
    </section>;
}
