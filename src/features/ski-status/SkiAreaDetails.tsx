import { conditionColumns, mountainColumns, formatElevation, formatSkiLocation, formatSkiStat, formatTemperature, type SkiUnits } from './browse';
import { passNames, passSeason, type SkiArea } from './catalog';
import { areaForecast, localReportTime, reportAgeHours, terrainStatusText, type Conditions, type ResortReport } from './conditions';
import { accessLabels, evaluatePass, type PassProduct } from './passRules';
import { SkiPassIcon } from './SkiPassIcon';
import { SkiSeasonDetails } from './SkiSeasonDetails';

const linkClass = 'inline-flex min-h-11 items-center text-cyan-300 underline decoration-cyan-700 underline-offset-4 hover:text-cyan-100';
const passAccessNotes = { included: '', discount: ' (discount only)', listed: ' (lift access unconfirmed)' };
const detailColumns = mountainColumns.slice(2);
const seasonLabel = 'Published season window';
const difficultyLabel = 'Published difficulty';
const statisticLabels = new Map<string, string>([
    ...detailColumns.map(({ key, label }) => [key, label] as const),
    ['seasonWindow', seasonLabel], ['grades', difficultyLabel],
    ['acresQualifier', 'Skiable area lower bound'], ['trailCountQualifier', 'Trail count lower bound'],
    ['nightAcresQualifier', 'Night area lower bound'],
]);

function detailSourceLinks(area: SkiArea) {
    const seen = new Set<string>();
    const links: { url: string; label: string }[] = [];
    const addLink = (url: string | undefined, label: string) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        links.push({ url, label });
    };
    addLink(area.website, area.website === area.reportUrl ? 'Resort website and conditions' : 'Resort website');
    addLink(area.reportUrl, 'Official conditions');
    for (const pass of area.passes) seen.add(pass.source);
    for (const group of area.statSources ?? []) seen.add(group.source);
    addLink(area.statsUrl, 'Mountain stats source');
    addLink(area.location.mappedTerrain?.source, 'OpenSkiMap terrain');
    let extra = 0;
    for (const url of area.additionalSources ?? []) {
        if (seen.has(url)) continue;
        addLink(url, `Additional source ${++extra}`);
    }
    return links;
}

interface Props {
    area: SkiArea;
    units: SkiUnits;
    onClose: () => void;
    conditions?: Conditions;
    product?: PassProduct;
    skiDate?: string;
    homeAreaId?: string;
}

function ReportedTerrain({ report, area, now }: { report: ResortReport; area: SkiArea; now: number }) {
    if (!report.terrain) return null;
    const { items, source } = report.terrain;
    const sortedItems = [...items].sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open'));
    return <details className="mt-2 border-t border-zinc-800">
        <summary className="min-h-11 cursor-pointer py-3 text-zinc-200 hover:text-cyan-300">Reported lifts and trails ({items.length})</summary>
        {source && <a href={source.url} className={linkClass}>{source.name} terrain records</a>}
        <div className="max-h-52 overflow-auto">
            <table className="w-full text-left text-xs">
                <caption className="sr-only">Reported lift and trail status</caption>
                <thead className="sticky top-0 bg-zinc-950 text-zinc-400"><tr>
                    <th scope="col" className="py-1 font-medium">Name</th>
                    <th scope="col" className="py-1 font-medium">Type</th>
                    <th scope="col" className="py-1 font-medium">Status</th>
                    {source && <th scope="col" className="py-1 font-medium">Record time</th>}
                </tr></thead>
                <tbody>{sortedItems.map(item => <tr key={item.id} className="border-t border-zinc-800">
                    <th className="py-1 pr-2 font-medium" scope="row">{item.name}</th>
                    <td className="py-1 pr-2">{item.kind === 'lift' ? 'Lift' : 'Trail'}</td>
                    <td className="py-1 pr-2">{terrainStatusText(item, report, now)}</td>
                    {source && <td className="py-1">{item.updatedAt
                        ? <time dateTime={item.updatedAt}>{localReportTime(item.updatedAt, area)}</time> : 'Unknown'}</td>}
                </tr>)}</tbody>
            </table>
        </div>
    </details>;
}

export function SkiAreaDetails({ area, units, onClose, conditions, product, skiDate, homeAreaId }: Props) {
    const stats = detailColumns.flatMap(({ key, label }) => {
        const value = formatSkiStat(area, key, units);
        return value === undefined && key.startsWith('mapped') ? [] : [{ key, label, value }];
    });
    const report = conditions?.reports.get(area.id);
    const temperature = report?.temperature;
    const forecast = areaForecast(conditions, area.id);
    const age = reportAgeHours(report, conditions?.now ?? 0);
    const access = product && conditions && evaluatePass(product, area, conditions.now, skiDate, homeAreaId);
    const rule = access?.rule;
    return <section id="ski-area-details" tabIndex={-1} aria-labelledby="ski-area-name" className="bg-zinc-950 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
                <h2 id="ski-area-name" className="text-xl font-semibold text-zinc-100">{area.name}</h2>
                <p className="text-sm text-zinc-300">{formatSkiLocation(area)}</p>
            </div>
            <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-zinc-300 underline underline-offset-4 hover:text-white">Close details</button>
        </div>
        {(report || forecast) && <section aria-label="Conditions summary" className="border-t border-zinc-800 py-2 text-sm">
            {report && <p>
                <a href={report.source.url} className={linkClass}>{report.source.name} report</a>{' · '}
                {report.reportedAt ? <time dateTime={report.reportedAt}>{localReportTime(report.reportedAt, area)}</time>
                    : report.reportedOn ? <time dateTime={report.reportedOn}>{report.reportedOn}</time> : 'Report time unknown'}
                {age !== undefined && ` · ${age < 1 ? 'Less than an hour old' : `${Math.floor(age)} h old`}`}
            </p>}
            {report?.snowLocation && <p>Snow measurement at {report.snowLocation}{report.snowReportedOn &&
                <> · <time dateTime={report.snowReportedOn}>{report.snowReportedOn}</time></>}</p>}
            {temperature && <p>
                Measured temperature {formatTemperature(temperature.valueC, units)} at {temperature.location}{' · '}
                <time dateTime={temperature.measuredAt}>{localReportTime(temperature.measuredAt, area)}</time>
            </p>}
            {report?.closedOn && <p>Season closed <time dateTime={report.closedOn}>{report.closedOn}</time></p>}
            {report?.hours && <p>{report.hours}</p>}
            {report?.nightOpen !== undefined && <p>Night operations {report.nightOpen ? 'open' : 'closed'}</p>}
            {forecast && <p>
                <a href={forecast.source.url} className={linkClass}>{forecast.source.name} forecast</a>{' · '}{forecast.location}
                {forecast.elevationM !== undefined && ` (${formatElevation(forecast.elevationM / 0.3048, units)})`}{' · '}
                <time dateTime={forecast.startsAt}>{localReportTime(forecast.startsAt, area)}</time>{' to '}
                <time dateTime={forecast.endsAt}>{localReportTime(forecast.endsAt, area)}</time>
                {forecast.issuedAt && <> · Issued <time dateTime={forecast.issuedAt}>{localReportTime(forecast.issuedAt, area)}</time></>}
            </p>}
            <dl className="flex flex-wrap gap-3">
                {conditionColumns.map(({ key, label }) => {
                    const value = formatSkiStat(area, key, units, conditions);
                    return value !== undefined && <div key={key}><dt className="text-zinc-400">{label}</dt><dd>{value}</dd></div>;
                })}
            </dl>
            {report?.terrain && conditions && <ReportedTerrain report={report} area={area} now={conditions.now} />}
        </section>}
        <SkiSeasonDetails area={area} units={units} now={conditions?.now} />
        <div className="flex flex-wrap gap-x-5 text-sm">
            {detailSourceLinks(area).map(({ url, label }) => <a key={url} className={linkClass} href={url}>{label}</a>)}
        </div>
        {area.statSources && area.statSources.length > 0 && <details className="border-t border-zinc-800 text-sm">
            <summary className="min-h-11 cursor-pointer py-3 text-zinc-200 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300">
                Published statistic sources
            </summary>
            <ul className="space-y-2 pb-3">{area.statSources.map(({ fields, source, checkedOn, note }) => <li key={fields[0]}>
                <a className={linkClass} href={source}>{fields.map(field => statisticLabels.get(field) ?? field).join(', ')}</a>
                <p className="text-zinc-400">Checked <time dateTime={checkedOn}>{checkedOn}</time></p>
                {note && <p className="text-zinc-300">{note}</p>}
            </li>)}</ul>
        </details>}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3 border-t border-zinc-800 pt-3 text-sm">
            {stats.map(({ key, label, value }) => <div key={key}>
                <dt className="text-zinc-400">{label}</dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">{value ?? 'Unknown'}</dd>
            </div>)}
            <div>
                <dt className="text-zinc-400">{seasonLabel}</dt>
                <dd className="mt-0.5 text-zinc-100">{area.seasonWindow ?? 'Unknown'}</dd>
            </div>
        </dl>
        {area.grades && <div className="mt-4 border-t border-zinc-800 pt-3">
            <h3 className="text-sm font-medium text-zinc-200">{difficultyLabel}{area.grades.of ? ` by ${area.grades.of}` : ''}</h3>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">{Object.entries(area.grades.values).map(([label, value]) => <div key={label}>
                <dt className="text-zinc-400">{label}</dt><dd className="tabular-nums text-zinc-100">{value}{area.grades?.unit === 'percent' ? '%' : ''}</dd>
            </div>)}</dl>
        </div>}
        {area.passes.length > 0 && <div className="mt-4 border-t border-zinc-800 pt-3">
            <h3 className="text-sm font-medium text-zinc-200">{passSeason} pass access</h3>
            <ul className="flex flex-wrap gap-x-5 text-sm">{area.passes.map(pass => <li key={pass.family}>
                <a className={`${linkClass} gap-2`} href={pass.source}>
                    <SkiPassIcon family={pass.family} />{passNames[pass.family]}{passAccessNotes[pass.access]}
                </a>
            </li>)}</ul>
        </div>}
        {product && access && <section aria-label="Pass product terms" className="mt-4 border-t border-zinc-800 pt-3 text-sm">
            <h3 className="font-medium">{product.name}</h3>
            <p>{accessLabels[access.status]}{access.date && <> · <time dateTime={access.date}>{access.date}</time></>}</p>
            {rule && <ul className="space-y-1 text-zinc-300">
                {rule.days !== undefined && <li>{rule.days === 'unlimited' ? 'Unlimited days' : `${rule.days} days`}{rule.shared && ` shared across ${rule.shared}`}</li>}
                {access.totalDays && <li>{access.totalDays} days total across this product</li>}
                {rule.consecutiveDays && <li>Use days consecutively</li>}
                {rule.reservation === 'required' && <li>Advance reservation required</li>}
                {rule.reservation === 'check' && <li>Check partner reservation requirements</li>}
                {rule.note && <li>{rule.note}</li>}
                <li><a className={linkClass} href={rule.source}>Official pass terms</a> · Checked <time dateTime={rule.checkedOn}>{rule.checkedOn}</time></li>
            </ul>}
        </section>}
    </section>;
}
