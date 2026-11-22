import { useId, useState } from 'react';
import { formatSeasonLength, formatSnowDepth, snowDepthValue, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions } from './conditions';
import { skiSnowHistory } from './resortDetailsData';
import { includesSeasonMonth, seasonMonths, skiSeasonOutlook } from './seasons';

type Outlook = ReturnType<typeof skiSeasonOutlook>;
type SnowProfile = NonNullable<ReturnType<typeof skiSnowHistory.get>>;
type SnowSource = { source: string; label: string; period?: string; location?: string };
type Citation = SnowSource & { measure: string };
type SnowMonth = { month: number; label: string; snowfall?: number; depth?: number; depthSource?: string; inSeason: boolean };
const northernSnowMonths = [...seasonMonths.slice(9), ...seasonMonths.slice(0, 5)];
const snowfallHeading = 'Average monthly snowfall';
const depthLabels = {
    base: { heading: 'Average base depth', column: 'Base depth', source: 'Average snow depth' },
    survey: { heading: 'Survey snow depth', column: 'Survey depth', source: 'Early-month snow depth' },
    station: { heading: 'Average station depth', column: 'Station depth', source: 'Average snow depth' },
    'monthly-peak': { heading: 'Average monthly maximum depth', column: 'Monthly max depth', source: 'Average monthly maximum snow depth' },
};

function BoundaryDate({ label, boundary }: { label: string; boundary: Outlook['opening'] }) {
    if (!boundary) return <div><dt>{label}</dt><dd className="ski-season-missing">Unknown</dd></div>;
    const date = boundary.date ? <time dateTime={boundary.date}>{boundary.label}</time> : boundary.label;
    return <div>
        <dt>{label}</dt>
        <dd>{boundary.source ? <a className="ski-season-source" href={boundary.source}>{date}</a> : <span>{date}</span>}
            <span className="ski-season-basis">{boundary.basis}</span>
        </dd>
    </div>;
}

function TypicalSeason({ window }: { window: NonNullable<Outlook['typical']> }) {
    const { evidence, source, lengthDays } = window;
    const publishedNote = evidence && 'source' in evidence ? evidence.note : undefined;
    return <div className="ski-typical-season">
        <p><strong>Typical season</strong> {publishedNote ?? `${window.opening} – ${window.closing}`}</p>
        {lengthDays !== undefined && <p><strong>Typical season length</strong> {formatSeasonLength(lengthDays)}</p>}
        {evidence && 'count' in evidence && <p className="ski-season-note">Median of {evidence.count} seasons through {evidence.latest}</p>}
        {source && <a className="ski-season-source ski-season-note" href={source}>Season source</a>}
    </div>;
}

function snowAxis(maximum: number) {
    const half = Math.max(1, maximum / 2);
    const increment = 10 ** Math.floor(Math.log10(half)) / 2;
    const middle = Math.ceil(half / increment) * increment;
    return [0, middle, middle * 2] as const;
}

function snowDepthPath(months: readonly SnowMonth[], height: (cm: number) => number) {
    let connected = false;
    return months.flatMap(({ depth }, index) => {
        if (depth === undefined) {
            connected = false;
            return [];
        }
        const command = connected ? 'L' : 'M';
        connected = true;
        return [`${command}${index + 0.5} ${100 - height(depth)}`];
    }).join(' ');
}

function MonthlySnowChart({ snowfall, depth, northern, typical, units }: {
    snowfall?: NonNullable<SnowProfile['snowfall']>['monthlyCm'];
    depth?: SnowProfile['depth'];
    northern: boolean;
    typical: Outlook['typical'];
    units: SkiUnits;
}) {
    const id = useId();
    const [selectedMonth, setSelectedMonth] = useState<number>();
    const [hoveredMonth, setHoveredMonth] = useState<number>();
    const year = (northern ? northernSnowMonths : seasonMonths).map(({ month, label }): SnowMonth => ({
        month, label, snowfall: snowfall?.[month], depth: depth?.monthlyCm[month], depthSource: depth?.monthlySources?.[month],
        inSeason: includesSeasonMonth(typical, month),
    }));
    const hasMeasurement = (month: SnowMonth) => month.snowfall !== undefined || month.depth !== undefined;
    const included = year.map(month => hasMeasurement(month) || month.inSeason);
    const first = included.indexOf(true);
    if (first === -1) return <p className="ski-season-note">
        {northern && (snowfall || depth) ? 'Monthly snow history is unavailable for October–May.' : 'Monthly snow history is unavailable.'}
    </p>;

    const months = northern ? year : year.slice(first, included.lastIndexOf(true) + 1);
    const hasSnow = months.some(hasMeasurement);
    const axisPeak = Math.max(...months.map(month => Math.max(month.snowfall ?? 0, month.depth ?? 0)));
    const ticks = snowAxis(snowDepthValue(axisPeak, units));
    const height = (cm: number) => snowDepthValue(cm, units) / ticks[2] * 100;
    const depthLine = snowDepthPath(months, height);
    const initial = months.find(month => month.snowfall && month.depth) ?? months.find(hasMeasurement) ?? year[first];
    const selected = months.find(month => month.month === selectedMonth) ?? initial;
    const inspected = months.find(month => month.month === hoveredMonth) ?? selected;
    const depthLabel = depthLabels[depth?.kind ?? 'base'];
    const unit = units === 'metric' ? 'cm' : 'in';
    const amount = (cm: number | undefined) => cm === undefined ? 'Unavailable' : formatSnowDepth(cm, units);
    const seasonStatus = (month: SnowMonth) => typical ? (month.inSeason ? 'In season' : 'Outside season') : 'Unavailable';

    return <figure className="ski-snow-figure" aria-labelledby={`${id}-heading`}>
        <figcaption className="ski-snow-heading">
            <h4 id={`${id}-heading`}>Monthly snow and season <span className="ski-snow-unit">({unit})</span></h4>
            <p id={`${id}-hint`}>Hover or select a month.</p>
        </figcaption>
        <fieldset className="ski-snow-picker" aria-describedby={`${id}-hint`}>
            <legend className="sr-only">Chart month</legend>
            <div className="ski-snow-plot" data-season-only={!hasSnow || undefined}>
                {hasSnow && <div className="ski-snow-axis" aria-hidden="true">
                    {[...ticks].reverse().map(tick => <span key={tick}>{tick.toLocaleString('en-US')}</span>)}
                </div>}
                <div className="ski-snow-columns" data-dense={months.length > 9 || undefined}
                    style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
                    onPointerLeave={() => setHoveredMonth(undefined)}>
                    {depthLine && <svg className="ski-snow-depth-line" viewBox={`0 0 ${months.length} 100`} preserveAspectRatio="none"
                        aria-hidden="true" focusable="false">
                        <path className="ski-snow-depth-outline" d={depthLine} vectorEffect="non-scaling-stroke" />
                        <path d={depthLine} vectorEffect="non-scaling-stroke" />
                    </svg>}
                    {months.map(row => <label key={row.month} className="ski-snow-column" data-inspected={row === inspected || undefined}
                        onPointerEnter={event => { if (event.pointerType !== 'touch') setHoveredMonth(row.month); }}>
                        <input type="radio" className="sr-only" name={id} checked={row === selected} aria-label={row.label}
                            aria-description={`${snowfallHeading} ${amount(row.snowfall)}. ${depthLabel.heading} ${amount(row.depth)}. ${typical ? seasonStatus(row) : 'Typical season unavailable'}.`}
                            onFocus={() => setHoveredMonth(undefined)} onChange={() => { setHoveredMonth(undefined); setSelectedMonth(row.month); }} />
                        {hasSnow && <span className="ski-snow-track" aria-hidden="true">
                            {row.snowfall !== undefined && <span className="ski-snow-bar" data-zero={row.snowfall === 0 || undefined}
                                style={{ height: `${height(row.snowfall)}%` }} />}
                            {row.depth !== undefined && <span className="ski-snow-depth-point" style={{ bottom: `${height(row.depth)}%` }} />}
                        </span>}
                        <span className="ski-snow-month" aria-hidden="true">{row.label.slice(0, 3)}</span>
                        {typical && <span className="ski-snow-season-track" aria-hidden="true" data-typical={row.inSeason || undefined} />}
                    </label>)}
                </div>
            </div>
        </fieldset>
        <div className="ski-snow-readout">
            <p className="ski-snow-readout-month">{inspected.label}</p>
            <dl>
                <div><dt><span className="ski-snow-key" data-series="snowfall" aria-hidden="true" />{snowfallHeading}</dt><dd>{amount(inspected.snowfall)}</dd></div>
                <div><dt><span className="ski-snow-key" data-series="depth" aria-hidden="true" />{depthLabel.heading}</dt><dd>{amount(inspected.depth)}</dd></div>
                <div><dt><span className="ski-snow-key" data-series="season" aria-hidden="true" />Typical season</dt><dd>{seasonStatus(inspected)}</dd></div>
            </dl>
        </div>
        <details className="ski-snow-values">
            <summary>Monthly values</summary>
            <table className="ski-snow-values-table">
                <caption className="sr-only">Monthly snow and season ({unit})</caption>
                <thead><tr><th scope="col">Month</th><th scope="col">Snowfall</th>
                    <th scope="col">{depthLabel.column}</th><th scope="col">Typical season</th></tr></thead>
                <tbody>{months.map(row =>
                    <tr key={row.month}>
                        <th scope="row">{row.label}</th>
                        <td>{amount(row.snowfall)}</td>
                        <td>{row.depthSource && row.depth !== undefined
                            ? <a className="ski-season-source" href={row.depthSource}>{amount(row.depth)}</a> : amount(row.depth)}</td>
                        <td>{seasonStatus(row)}</td>
                    </tr>)}</tbody>
            </table>
        </details>
    </figure>;
}

function sourceGroupKey({ label, location, period }: SnowSource) {
    return JSON.stringify([label, location, period]);
}

function SnowSources({ citations }: { citations: Citation[] }) {
    const groups = new Map<string, Citation[]>();
    for (const citation of citations) {
        const key = sourceGroupKey(citation);
        const group = groups.get(key);
        if (group) group.push(citation);
        else groups.set(key, [citation]);
    }

    return <details className="ski-snow-sources">
        <summary>Snow sources</summary>
        <ul aria-label="Historical snow sources">{[...groups].map(([key, group]) => {
            const { label, location, period } = group[0];
            return <li key={key}>
                <p><strong>{label}</strong>{location && ` · ${location}`}{period && ` · ${period}`}</p>
                <div className="ski-snow-source-links">{group.map(({ measure, source }) =>
                    <a key={measure} className="ski-season-source" href={source}>{measure}</a>)}</div>
            </li>;
        })}</ul>
    </details>;
}

export function SkiSeasonChart({ area, date, units, conditions }: { area: SkiArea; date: string; units: SkiUnits; conditions?: Conditions }) {
    const { season, opening, closing, note, historical, typical } = skiSeasonOutlook(area, date, conditions);
    const { snowfall, depth } = skiSnowHistory.get(area.id) ?? {};
    const showBoundaries = [opening, closing].some(boundary => boundary && boundary.basis !== 'Estimated');
    const annualCm = snowfall?.annualCm;
    const annualOverride = snowfall?.annualSource;
    const annualSource = typeof annualOverride === 'string'
        ? { source: annualOverride, label: new URL(annualOverride).hostname } : annualOverride ?? snowfall;
    const sharesSnowfallSource = annualCm !== undefined && annualSource && snowfall?.monthlyCm
        && annualSource.source === snowfall.source && sourceGroupKey(annualSource) === sourceGroupKey(snowfall);
    const citations: Citation[] = [];
    if (annualCm !== undefined && annualSource && !sharesSnowfallSource) {
        citations.push({ ...annualSource, measure: 'Annual snowfall' });
    }
    if (snowfall?.monthlyCm) citations.push({ ...snowfall, measure: sharesSnowfallSource ? 'Annual and monthly snowfall' : 'Monthly snowfall totals' });
    if (depth) citations.push({ ...depth, measure: depthLabels[depth.kind].source });

    return <div className="ski-season-chart">
        <div className="ski-season-title">
            <h3>Season and snowfall</h3>
            {season && <span className="ski-season-year">{historical ? 'Last recorded season' : 'Season'} {season}</span>}
        </div>
        {(showBoundaries || annualCm !== undefined) && <dl className="ski-season-metrics">
            {showBoundaries && <><BoundaryDate label="Opening" boundary={opening} /><BoundaryDate label="Closing" boundary={closing} /></>}
            {annualCm !== undefined && annualSource && <div><dt>Annual snowfall</dt>
                <dd><a className="ski-season-source" href={annualSource.source}>{formatSnowDepth(annualCm, units)}</a>
                    <span className="ski-season-basis">Average</span>
                </dd>
            </div>}
        </dl>}
        {note && <p className="ski-season-note">{note}</p>}
        {typical ? <TypicalSeason window={typical} />
            : <p className="ski-season-note">{opening || closing ? 'Typical dates unavailable.' : 'Season dates unavailable.'}</p>}
        <MonthlySnowChart key={area.id} snowfall={snowfall?.monthlyCm} depth={depth} typical={typical} units={units}
            northern={area.location.coordinates[1] >= 0} />
        {citations.length > 0 && <SnowSources citations={citations} />}
    </div>;
}
