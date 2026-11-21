import { formatSnowDepth, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions } from './conditions';
import { skiSnowHistory } from './resortDetailsData';
import { seasonMonths, skiSeasonOutlook } from './seasons';

type Boundary = ReturnType<typeof skiSeasonOutlook>['opening'];
const northernSnowMonths = [...seasonMonths.slice(6), ...seasonMonths.slice(0, 6)];
const depthLabels = {
    base: { heading: 'Avg. base depth', source: 'Average snow depth' },
    survey: { heading: 'Survey depth', source: 'Early-month snow depth' },
    station: { heading: 'Avg. station depth', source: 'Average snow depth' },
    'monthly-peak': { heading: 'Avg. monthly max depth', source: 'Average monthly maximum snow depth' },
};

function BoundaryDate({ label, boundary }: { label: string; boundary: Boundary }) {
    if (!boundary) return <div><dt>{label}</dt><dd className="ski-season-missing">Unknown</dd></div>;
    const date = boundary.date ? <time dateTime={boundary.date}>{boundary.label}</time> : boundary.label;
    return <div>
        <dt>{label}</dt>
        <dd>{boundary.source ? <a className="ski-season-source" href={boundary.source}>{date}</a> : <span>{date}</span>}
            <span className="ski-season-basis">{boundary.basis}</span>
        </dd>
    </div>;
}

function operatingMonths(opening: Boundary, closing: Boundary) {
    if (!opening || !closing) return [];
    const start = opening.month - 1;
    const months = [...seasonMonths.slice(start), ...seasonMonths.slice(0, start)];
    return months.slice(0, months.findIndex(({ month }) => month === closing.month) + 1);
}

function SnowValue({ value, maximum, units, source }: { value?: number; maximum: number; units: SkiUnits; source?: string }) {
    if (value === undefined) return <td className="ski-season-missing"><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></td>;
    const text = formatSnowDepth(value, units);
    return <td>
        <span className="ski-snow-bar" aria-hidden="true" style={{ width: `${maximum ? value / maximum * 100 : 0}%` }} />
        {source ? <a className="ski-season-source" href={source}>{text}</a> : <span>{text}</span>}
    </td>;
}

function SnowSource({ data, label }: { data: { source: string; label: string; period?: string; location?: string }; label: string }) {
    return <li>{label} · <a href={data.source} className="ski-season-source">{data.label}</a>
        {data.location && ` · ${data.location}`}{data.period && ` · ${data.period}`}
    </li>;
}

export function SkiSeasonChart({ area, date, units, conditions }: { area: SkiArea; date: string; units: SkiUnits; conditions?: Conditions }) {
    const { season, opening, closing, note } = skiSeasonOutlook(area, date, conditions);
    const { snowfall, depth } = skiSnowHistory.get(area.id) ?? {};
    const monthlySnowfall = snowfall?.monthlyCm;
    const monthlyDepth = depth?.monthlyCm;
    const year = area.location.coordinates[1] < 0 ? seasonMonths : northernSnowMonths;
    const months = year.filter(({ month }) => monthlySnowfall?.[month] !== undefined || monthlyDepth?.[month] !== undefined);
    const maximum = Math.max(0, ...Object.values(monthlySnowfall ?? {}), ...Object.values(monthlyDepth ?? {}));
    const seasonRange = months.length ? [] : operatingMonths(opening, closing);
    const annualCm = snowfall?.annualCm;
    const annualOverride = snowfall?.annualSource;
    const annualSource = typeof annualOverride === 'string' ? { source: annualOverride } : annualOverride ?? snowfall;
    const sharesSnowfallSource = annualCm !== undefined && annualSource === snowfall && monthlySnowfall;
    const separateAnnualCitation = annualCm !== undefined && annualSource && 'label' in annualSource && !sharesSnowfallSource;

    return <div className="ski-season-chart">
        <div className="ski-season-title">
            <h3>Season and snowfall</h3>
            {season && <span>{season}</span>}
        </div>
        {(opening || closing || annualCm !== undefined) && <dl className="ski-season-metrics">
            {(opening || closing) && <><BoundaryDate label="Opening" boundary={opening} /><BoundaryDate label="Closing" boundary={closing} /></>}
            {annualCm !== undefined && annualSource && <div><dt>Avg. annual snowfall</dt>
                <dd><a className="ski-season-source" href={annualSource.source}>{formatSnowDepth(annualCm, units)}</a></dd>
            </div>}
        </dl>}
        {note && <p className="ski-season-note">{note}</p>}
        {months.length > 0 ? (
            <table className="ski-snow-table">
                <caption className="sr-only">Typical monthly snow</caption>
                <thead><tr><th scope="col">Month</th>{monthlySnowfall && <th scope="col">Avg. snowfall</th>}
                    {depth && <th scope="col">{depthLabels[depth.kind].heading}</th>}
                </tr></thead>
                <tbody>{months.map(({ label, month }) => <tr key={month}>
                    <th scope="row">{label}</th>
                    {monthlySnowfall && <SnowValue value={monthlySnowfall[month]} maximum={maximum} units={units} />}
                    {depth && <SnowValue value={depth.monthlyCm[month]} maximum={maximum} units={units} source={depth.monthlySources?.[month]} />}
                </tr>)}</tbody>
            </table>
        ) : <>
            {seasonRange.length > 1 && <ol className="ski-season-months" aria-label="Season months">{seasonRange.map(({ label, month }) =>
                <li key={month}><abbr title={label}>{label.slice(0, 3)}</abbr></li>)}</ol>}
            <p className="ski-season-note">{!opening && !closing ? 'Season dates and monthly snow history are unavailable.' : 'Monthly snow history is unavailable.'}</p>
        </>}
        {(separateAnnualCitation || months.length > 0) && <ul className="ski-season-note" aria-label="Historical snow sources">
            {separateAnnualCitation && <SnowSource data={annualSource} label="Annual snowfall" />}
            {monthlySnowfall && <SnowSource data={snowfall} label={sharesSnowfallSource ? 'Annual and monthly snowfall' : 'Monthly snowfall totals'} />}
            {depth && <SnowSource data={depth} label={depthLabels[depth.kind].source} />}
        </ul>}
    </div>;
}
