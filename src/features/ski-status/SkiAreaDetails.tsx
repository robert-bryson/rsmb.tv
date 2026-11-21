import { lazy, Suspense, useState, type Ref } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { conditionColumns, mountainColumns, formatElevation, formatSkiStat, formatSnowDepth, formatTemperature, type SkiUnits } from './browse';
import { passNames, passSeason, type SkiArea } from './catalog';
import { areaForecast, isFreshReport, localReportTime, reportAgeHours, reportAgeLabel, skiDayStatus, terrainStatusText, type Conditions, type ResortReport } from './conditions';
import { localSkiDate } from './localSkiDate';
import { accessLabels, evaluatePass, type PassProduct } from './passRules';
import { skiResortIconCandidates } from './resortDetailsData';
import { SkiIconButton } from './SkiIcon';
import { SkiLocation } from './SkiLocation';
import { SkiPassIcon } from './SkiPassIcon';
import { SkiAssetIcon } from './SkiAssetIcon';
import { SkiResortLinks } from './SkiResortLinks';
import { SkiSeasonDetails } from './SkiSeasonDetails';
import { SkiStatusLabel } from './SkiStatusLabel';
import type { SkiArchiveResort } from './useSkiArchive';

const SkiVisitorInformation = lazy(() => import('./SkiVisitorInformation'));
const linkClass = 'inline-flex min-h-11 items-center text-cyan-300 underline decoration-cyan-700 underline-offset-4 hover:text-cyan-100';
const passAccessNotes = { included: '', discount: ' (discount only)', listed: ' (lift access unconfirmed)' };
const detailColumns = mountainColumns.slice(2);

const seasonLabel = 'Published season window';
const difficultyLabel = 'Published difficulty';
const reportDisclosureClass = 'min-h-11 cursor-pointer py-3 text-zinc-200 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300';
const snowFields = [
    ['baseCm', 'Base depth'], ['overnightCm', 'Overnight'], ['snow24HoursCm', 'Past 24 hours'],
    ['snow48HoursCm', 'Past 48 hours'], ['snow72HoursCm', 'Past 72 hours'], ['snow7DaysCm', 'Past 7 days'],
    ['seasonTotalCm', 'Season total'],
] as const;
const forecastDayLabel = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const statisticLabels = new Map<string, string>([
    ...detailColumns.map(({ key, label }) => [key, label] as const),
    ['seasonWindow', seasonLabel], ['grades', difficultyLabel],
    ['acresQualifier', 'Skiable area lower bound'], ['trailCountQualifier', 'Trail count lower bound'],
    ['nightAcresQualifier', 'Night area lower bound'], ['nordicKmQualifier', 'Nordic trail length lower bound'],
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
    const base = area.location.base;
    if (base) addLink(base.source, base.kind === 'entrance' ? base.name : 'Mapped lift base');
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
    sectionRef?: Ref<HTMLElement>;
    onClose: () => void;
    onShowTerrain?: () => void;
    onZoomLocation?: (place: string) => void;
    conditions?: Conditions;
    archive?: SkiArchiveResort;
    product?: PassProduct;
    skiDate?: string;
    homeAreaId?: string;
}

function ReportedTerrain({ report, area, now }: { report: ResortReport; area: SkiArea; now: number }) {
    const [expanded, setExpanded] = useState(false);
    if (!report.terrain) return null;
    const { items, source } = report.terrain;
    const sortedItems = expanded ? [...items].sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open')) : [];
    return <details className="mt-2 border-t border-zinc-800" onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary className={reportDisclosureClass}>Reported lifts and trails ({items.length})</summary>
        {expanded && <>
            {source && <a href={source.url} className={linkClass}>{source.name} terrain records</a>}
            <div role="region" aria-label="Lift and trail status records" tabIndex={0}
                className="max-h-52 overflow-auto focus-visible:outline-2 focus-visible:outline-cyan-300">
                <table className="w-full text-left text-xs">
                    <caption className="sr-only">Reported lift and trail status</caption>
                    <thead className="sticky top-0 bg-zinc-950 text-zinc-400"><tr>
                        <th scope="col" className="py-1 font-medium">Name</th>
                        <th scope="col" className="py-1 font-medium">Type</th>
                        <th scope="col" className="py-1 font-medium">Status</th>
                        {source && <th scope="col" className="py-1 font-medium">Record time</th>}
                    </tr></thead>
                    <tbody>{sortedItems.map(item => <tr key={item.id} className="border-t border-zinc-800">
                        <th className="py-1 pr-2 font-medium" scope="row">
                            {item.name}
                            {(item.area || item.liftType || item.difficulty || item.groomed || item.snowmaking) &&
                                <span className="block font-normal text-zinc-400">{[
                                    item.area, item.liftType, item.difficulty, item.groomed && 'Groomed', item.snowmaking && 'Snowmaking',
                                ].filter(Boolean).join(' · ')}</span>}
                        </th>
                        <td className="py-1 pr-2">{item.kind === 'lift' ? 'Lift' : 'Trail'}</td>
                        <td className="py-1 pr-2">{terrainStatusText(item, report, now)}</td>
                        {source && <td className="py-1">{item.updatedAt
                            ? <time dateTime={item.updatedAt}>{localReportTime(item.updatedAt, area)}</time> : 'Unknown'}</td>}
                    </tr>)}</tbody>
                </table>
            </div>
        </>}
    </details>;
}

function ReportedSnow({ locations, units, age }: { locations: NonNullable<ResortReport['snowByLocation']>; units: SkiUnits; age: string }) {
    return <details className="mt-2 border-t border-zinc-800">
        <summary className={reportDisclosureClass}>Snow by location{age}</summary>
        <ul className="space-y-3 pb-2">{locations.map(location => <li key={location.location}>
            <h3 className="mb-1 font-medium text-zinc-200">{location.location}</h3>
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,6rem),1fr))] gap-2 text-xs">
                {snowFields.map(([field, label]) => {
                    const depth = location[field];
                    return depth !== undefined && <div key={field}>
                        <dt className="text-zinc-400">{label}</dt><dd>{formatSnowDepth(depth, units)}</dd>
                    </div>;
                })}
                {location.surface && <div><dt className="text-zinc-400">Surface</dt><dd>{location.surface}</dd></div>}
            </dl>
        </li>)}</ul>
    </details>;
}

function OperatorForecast({ report, area, units, now }: { report: ResortReport; area: SkiArea; units: SkiUnits; now: number }) {
    if (!report.forecastDays || !area.location.timeZone || !isFreshReport(report, now)) return null;
    const today = localSkiDate(now, area.location.timeZone);
    const days = report.forecastDays.filter(day => day.date >= today);
    if (!days.length) return null;
    const temperature = (value: number | undefined) => value === undefined ? '—' : formatTemperature(value, units);
    return <details className="border-t border-zinc-800">
        <summary className={reportDisclosureClass}>Operator forecast</summary>
        <table className="mb-2 w-full text-left text-xs">
            <caption className="sr-only">Daily forecast from {report.source.name}</caption>
            <thead className="text-zinc-400"><tr>
                <th scope="col" className="py-1 font-medium">Day</th>
                <th scope="col" className="py-1 font-medium">High</th>
                <th scope="col" className="py-1 font-medium">Low</th>
            </tr></thead>
            <tbody>{days.map(day => <tr key={day.date} className="border-t border-zinc-800">
                <th scope="row" className="py-1 pr-2 font-medium">
                    <time dateTime={day.date}>{forecastDayLabel.format(Date.parse(`${day.date}T00:00:00Z`))}</time>
                    {day.description && <span className="block font-normal text-zinc-400">{day.description}</span>}
                </th>
                <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{temperature(day.highC)}</td>
                <td className="whitespace-nowrap py-1 tabular-nums">{temperature(day.lowC)}</td>
            </tr>)}</tbody>
        </table>
    </details>;
}

export function SkiAreaDetails({ area, units, sectionRef, onClose, onShowTerrain, onZoomLocation, conditions, archive, product, skiDate, homeAreaId }: Props) {
    const stats = detailColumns.flatMap(({ key, label }) => {
        const value = formatSkiStat(area, key, units);
        return value === undefined && key.startsWith('mapped') ? [] : [{ key, label, value }];
    });
    const report = conditions?.reports.get(area.id);
    const temperature = report?.temperature;
    const forecast = areaForecast(conditions, area.id);
    const now = conditions?.now ?? 0;
    const age = reportAgeHours(report, now);
    const ageLabel = report && reportAgeLabel(report, now, area.location.timeZone);
    const operationsAge = ageLabel ? ` (${ageLabel})` : '';
    const status = skiDayStatus(report, now, area.location.timeZone);
    const access = product && conditions && evaluatePass(product, area, conditions.now, skiDate, homeAreaId);
    const rule = access?.rule;
    const links = detailSourceLinks(area);
    const officialConditions = links.find(({ url }) => url === area.reportUrl);
    return <section id="ski-area-details" ref={sectionRef} tabIndex={-1} aria-labelledby="ski-area-name" className="ski-details">
        <div className="ski-details-heading">
            <div className="ski-resort-identity">
                <SkiAssetIcon key={area.id} urls={skiResortIconCandidates(area.id, archive, 'detailsIcon').urls}
                    className="ski-resort-icon" size={42} />
                <div>
                    <h2 id="ski-area-name" className="text-xl font-semibold text-zinc-100">{area.name}</h2>
                    <p className="text-sm text-zinc-300"><SkiLocation area={area} onZoom={onZoomLocation} /></p>
                </div>
            </div>
            <SkiIconButton className="ski-quiet-button" icon="close" label="Close details" onClick={onClose} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <SkiResortLinks area={area} />
            <SkiStatusLabel status={status} report={report} now={now} />
            {officialConditions && <a className={linkClass} href={officialConditions.url}>{officialConditions.label}</a>}
            {onShowTerrain && <button type="button" className="ski-control" aria-controls="ski-results-map"
                onClick={onShowTerrain}>Show runs and lifts</button>}
        </div>
        {(report || forecast) && <section aria-label="Conditions summary" className="border-t border-zinc-800 py-2 text-sm">
            {report && <p>
                {report.source.url === officialConditions?.url ? `${report.source.name} report` :
                    <a href={report.source.url} className={linkClass}>{report.source.name} report</a>}{' · '}
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
            {report?.hours && <p>{report.hours}{operationsAge}</p>}
            {report?.nightOpen !== undefined && <p>Night operations {report.nightOpen ? 'open' : 'closed'}{operationsAge}</p>}
            {forecast && <p>
                <a href={forecast.source.url} className={linkClass}>{forecast.source.name} forecast</a>{' · '}{forecast.location}
                {forecast.elevationM !== undefined && ` (${formatElevation(forecast.elevationM, units, 'metric')})`}{' · '}
                <time dateTime={forecast.startsAt}>{localReportTime(forecast.startsAt, area)}</time>{' to '}
                <time dateTime={forecast.endsAt}>{localReportTime(forecast.endsAt, area)}</time>
                {forecast.issuedAt && <> · Issued <time dateTime={forecast.issuedAt}>{localReportTime(forecast.issuedAt, area)}</time></>}
            </p>}
            <dl className="flex flex-wrap gap-3">
                {conditionColumns.filter(({ key }) => key !== 'operatingStatus').map(({ key, label }) => {
                    const value = formatSkiStat(area, key, units, conditions);
                    return value !== undefined && <div key={key}><dt className="text-zinc-400">{label}</dt><dd>{value}</dd></div>;
                })}
            </dl>
            {report?.snowByLocation && <ReportedSnow locations={report.snowByLocation} units={units} age={operationsAge} />}
            {report?.forecastDays && <OperatorForecast report={report} area={area} units={units} now={now} />}
            {report?.terrain && <ReportedTerrain report={report} area={area} now={now} />}
        </section>}
        <ErrorBoundary key={area.id} fallback={<p className="text-sm text-zinc-300">Visitor information unavailable.</p>}>
            <Suspense fallback={null}><SkiVisitorInformation areaId={area.id} archivedMaps={archive?.trailMaps} /></Suspense>
        </ErrorBoundary>
        <SkiSeasonDetails area={area} units={units} conditions={conditions} />
        <div className="flex flex-wrap gap-x-5 text-sm">
            {links.filter(link => link !== officialConditions).map(({ url, label }) => <a key={url} className={linkClass} href={url}>{label}</a>)}
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
