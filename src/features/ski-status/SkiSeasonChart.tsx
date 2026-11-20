import { formatSnowDepth, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions } from './conditions';
import { skiSnowHistory } from './resortDetailsData';
import { seasonMonths, skiSeasonOutlook } from './seasons';

type Boundary = ReturnType<typeof skiSeasonOutlook>['opening'];
type Measurements = Readonly<Record<string, number>>;
const depthLabels = { base: 'Avg. base depth', survey: 'Survey depth', station: 'Avg. station depth' };

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

function seasonChartMonths(season: string | undefined, opening: Boundary, closing: Boundary, snowfall?: Measurements, depth?: Measurements) {
    const start = (opening?.month ?? (season?.includes('/') ? 7 : 1)) - 1;
    const months = [...seasonMonths.slice(start), ...seasonMonths.slice(0, start)];
    if (opening && closing) return months.slice(0, months.findIndex(({ month }) => month === closing.month) + 1);
    return months.filter(({ month }) =>
        month === opening?.month || month === closing?.month || snowfall?.[month] !== undefined || depth?.[month] !== undefined);
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
    const months = seasonChartMonths(season, opening, closing, snowfall?.monthlyCm, depth?.monthlyCm);
    const hasSnowfall = months.some(({ month }) => snowfall?.monthlyCm?.[month] !== undefined);
    const hasDepth = months.some(({ month }) => depth?.monthlyCm[month] !== undefined);
    const maximum = Math.max(0, ...months.flatMap(({ month }) => [snowfall?.monthlyCm?.[month] ?? 0, depth?.monthlyCm[month] ?? 0]));

    return <div className="ski-season-chart">
        <div className="ski-season-title">
            <h3>Season and snowfall</h3>
            {season && <span>{season}</span>}
        </div>
        {(opening || closing || snowfall?.annualCm !== undefined) && <dl className="ski-season-metrics">
            {(opening || closing) && <><BoundaryDate label="Opening" boundary={opening} /><BoundaryDate label="Closing" boundary={closing} /></>}
            {snowfall?.annualCm !== undefined && <div><dt>Avg. annual snowfall</dt>
                <dd><a className="ski-season-source" href={snowfall.annualSource ?? snowfall.source}>{formatSnowDepth(snowfall.annualCm, units)}</a></dd>
            </div>}
        </dl>}
        {note && <p className="ski-season-note">{note}</p>}
        {hasSnowfall || hasDepth ? <>
            <table className="ski-snow-table">
                <caption className="sr-only">Typical monthly snow</caption>
                <thead><tr><th scope="col">Month</th>{hasSnowfall && <th scope="col">Avg. snowfall</th>}
                    {hasDepth && depth && <th scope="col">{depthLabels[depth.kind]}</th>}
                </tr></thead>
                <tbody>{months.map(({ label, month }) => <tr key={month}>
                    <th scope="row">{label}</th>
                    {hasSnowfall && <SnowValue value={snowfall?.monthlyCm?.[month]} maximum={maximum} units={units} />}
                    {hasDepth && <SnowValue value={depth?.monthlyCm[month]} maximum={maximum} units={units} source={depth?.monthlySources?.[month]} />}
                </tr>)}</tbody>
            </table>
            <ul className="ski-season-note" aria-label="Historical snow sources">
                {hasSnowfall && snowfall && <SnowSource data={snowfall} label="Monthly snowfall totals" />}
                {hasDepth && depth && <SnowSource data={depth} label={depth.kind === 'survey' ? 'Early-month snow depth' : 'Average snow depth'} />}
            </ul>
        </> : <>
            {months.length > 1 && <ol className="ski-season-months" aria-label="Season months">{months.map(({ label, month }) =>
                <li key={month}><abbr title={label}>{label.slice(0, 3)}</abbr></li>)}</ol>}
            <p className="ski-season-note">{!opening && !closing ? 'Season dates and monthly snow history are unavailable.' : 'Monthly snow history is unavailable.'}</p>
        </>}
    </div>;
}
