import { useState } from 'react';
import { formatSeasonLength, formatSnowDepth, snowDepthValue, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions } from './conditions';
import { skiSnowHistory } from './resortDetailsData';
import { includesSeasonMonth, seasonMonths, skiSeasonOutlook } from './seasons';

type Outlook = ReturnType<typeof skiSeasonOutlook>;
type SnowProfile = NonNullable<ReturnType<typeof skiSnowHistory.get>>;
type SnowSource = { source: string; label: string; period?: string; location?: string };
type Citation = SnowSource & { measure: string };
const northernSnowMonths = [...seasonMonths.slice(6), ...seasonMonths.slice(0, 6)];
const snowfallHeading = 'Average monthly snowfall';
const depthLabels = {
    base: { heading: 'Average base depth', source: 'Average snow depth' },
    survey: { heading: 'Survey snow depth', source: 'Early-month snow depth' },
    station: { heading: 'Average station depth', source: 'Average snow depth' },
    'monthly-peak': { heading: 'Average monthly maximum depth', source: 'Average monthly maximum snow depth' },
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

function MonthlySnowChart({ snowfall, depth, year, typical, units }: {
    snowfall?: NonNullable<SnowProfile['snowfall']>['monthlyCm'];
    depth?: SnowProfile['depth'];
    year: typeof seasonMonths;
    typical: Outlook['typical'];
    units: SkiUnits;
}) {
    const [metric, setMetric] = useState<'snowfall' | 'depth'>('snowfall');
    const showDepth = Boolean(depth && (!snowfall || metric === 'depth'));
    const heading = showDepth && depth ? depthLabels[depth.kind].heading : snowfallHeading;
    const values = showDepth ? depth?.monthlyCm : snowfall;
    if (!values) return <p className="ski-season-note">Monthly snow history is unavailable.</p>;

    const measured = year.map(({ month }) => snowfall?.[month] !== undefined || depth?.monthlyCm[month] !== undefined);
    const ticks = snowAxis(snowDepthValue(Math.max(...Object.values(values)), units));
    const maximum = ticks[2];
    const unit = units === 'metric' ? 'cm' : 'in';
    const months = year.slice(measured.indexOf(true), measured.lastIndexOf(true) + 1).map(({ month, label }) => {
        const value = values[month];
        return {
            month, label, inSeason: includesSeasonMonth(typical, month),
            height: value === undefined ? 0 : snowDepthValue(value, units) / maximum * 100,
            amount: value === undefined ? undefined : formatSnowDepth(value, units),
            source: showDepth ? depth?.monthlySources?.[month] : undefined,
        };
    });

    return <figure className="ski-snow-figure">
        <figcaption className="ski-snow-heading">
            <h4>{heading} <span className="ski-snow-unit">({unit})</span></h4>
            {snowfall && depth && <div className="ski-segments ski-snow-metrics" role="group" aria-label="Snow chart measure">
                <button type="button" aria-pressed={!showDepth} onClick={() => setMetric('snowfall')}>Snowfall</button>
                <button type="button" aria-pressed={showDepth} onClick={() => setMetric('depth')}>Snow depth</button>
            </div>}
        </figcaption>
        <div className="ski-snow-plot" aria-hidden="true">
            <div className="ski-snow-axis">{[...ticks].reverse().map(tick => <span key={tick}>{tick.toLocaleString('en-US')}</span>)}</div>
            <div className="ski-snow-columns" data-dense={months.length > 9 || undefined}
                style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
                {months.map(({ month, label, inSeason, height, amount }) =>
                    <div key={month} className="ski-snow-column" title={`${label} · ${amount ?? 'Unavailable'}`}>
                        <div className="ski-snow-track">
                            {height > 0 ? <span className="ski-snow-bar" style={{ height: `${height}%` }} />
                                : <span className="ski-snow-empty">{amount === undefined ? '—' : '0'}</span>}
                        </div>
                        <span className="ski-snow-month" data-typical={inSeason || undefined}>{label.slice(0, 3)}</span>
                    </div>)}
            </div>
        </div>
        <details className="ski-snow-values">
            <summary>Monthly values</summary>
            <table className="ski-snow-values-table">
                <caption className="sr-only">{heading} ({unit})</caption>
                <thead><tr><th scope="col">Month</th><th scope="col">Amount</th></tr></thead>
                <tbody>{months.map(({ month, label, inSeason, amount, source }) =>
                    <tr key={month}>
                        <th scope="row" aria-label={inSeason ? `${label}, typical season` : undefined}>{label}</th>
                        <td>{source && amount ? <a className="ski-season-source" href={source}>{amount}</a> : amount ?? 'Unavailable'}</td>
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
            year={area.location.coordinates[1] < 0 ? seasonMonths : northernSnowMonths} />
        {citations.length > 0 && <SnowSources citations={citations} />}
    </div>;
}
