import { drivingProviders, drivingProviderNames } from '../../../shared/skiDriving';
import { drivingProviderSources } from '../../../shared/skiDrivingCatalog';
import { isSpecialtySkiing, skiAreas, type SkiArea } from './catalog';
import { isCurrentForecast, isSkiingStatus, reportAgeLabel, skiDayStatus } from './conditions';
import { skiResortAccess } from './resortAccessData';
import { drivingCameras, drivingReports, roadReportState } from './drivingView';
import { skiResortIcon, skiSnowHistory } from './resortDetailsData';
import { resortTerrainGroups } from './resortTerrainData';
import { seasonCalendar } from './seasons';
import type { SkiConditions } from './useSkiConditions';
import { useSkiDriving } from './useSkiDriving';

const number = new Intl.NumberFormat('en');
const timestamp = new Intl.DateTimeFormat('en', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
});

const downhillAreas = skiAreas.filter(area => !isSpecialtySkiing(area.skiing));
const countries = new Set(skiAreas.flatMap(area => [area.country, ...area.otherCountries ?? []])).size;
const mountainFields = [
    ['acres', 'Skiable acreage'],
    ['verticalFt', 'Vertical drop'],
    ['liftCount', 'Lift counts'],
    ['trailCount', 'Trail counts'],
    ['baseFt', 'Base elevation'],
    ['summitFt', 'Summit elevation'],
] as const;

type CoverageCheck = { label: string; hasRecord: (area: SkiArea) => boolean };
type CoverageRow = { label: string; count: number };

function countCoverage(areas: readonly SkiArea[], checks: readonly CoverageCheck[]): CoverageRow[] {
    return checks.map(({ label, hasRecord }) => ({ label, count: areas.filter(hasRecord).length }));
}

const mountainCoverage = countCoverage(downhillAreas, [
    { label: 'All six comparison fields', hasRecord: area => mountainFields.every(([field]) => area[field] !== undefined) },
    ...mountainFields.map(([field, label]) => ({ label, hasRecord: (area: SkiArea) => area[field] !== undefined })),
]);

const catalogCoverage = countCoverage(skiAreas, [
    { label: 'Official conditions links', hasRecord: area => area.reportUrl !== undefined },
    { label: 'Checked conditions links', hasRecord: area => area.reportCheckedOn !== undefined },
    { label: 'Field-specific stat citations', hasRecord: area => Boolean(area.statSources?.length) },
    { label: 'Local time zones', hasRecord: area => area.location.timeZone !== undefined },
    { label: 'Pass listings', hasRecord: area => area.passes.length > 0 },
    { label: 'Dated season records', hasRecord: area => {
        const seasons = seasonCalendar.byArea.get(area.id);
        return Boolean(seasons && (seasons.actual.length || seasons.planned.length));
    } },
    { label: 'Snow history', hasRecord: area => skiSnowHistory.has(area.id) },
]);

const visitorCoverage = countCoverage(skiAreas, [
    { label: 'Mapped ski terrain', hasRecord: area => resortTerrainGroups([area]).length > 0 },
    { label: 'Verified winter entrances', hasRecord: area => area.location.base?.kind === 'entrance' },
    { label: 'Official trail maps', hasRecord: area => Boolean(skiResortAccess.get(area.id)?.trailMaps?.length) },
    { label: 'Parking information', hasRecord: area => {
        const access = skiResortAccess.get(area.id);
        return Boolean(access?.parking || access?.parkingPolicy);
    } },
    { label: 'Webcams', hasRecord: area => Boolean(skiResortAccess.get(area.id)?.webcams) },
    { label: 'Day-ticket prices', hasRecord: area => Boolean(skiResortAccess.get(area.id)?.liftTickets) },
    { label: 'Bundled resort icons', hasRecord: area => skiResortIcon(area.id) !== undefined },
]);

function countConditions({ reports, forecasts, now }: SkiConditions) {
    const counts = { skiing: 0, closed: 0, stale: 0, unverified: 0, missing: 0, forecasts: 0 };
    for (const area of skiAreas) {
        const forecast = forecasts.get(area.id);
        if (forecast && isCurrentForecast(forecast, now)) counts.forecasts++;
        const report = reports.get(area.id);
        if (!report) {
            counts.missing++;
            continue;
        }

        const status = skiDayStatus(report, now, area.location.timeZone);
        if (isSkiingStatus(status)) counts.skiing++;
        else if (status !== 'unknown') counts.closed++;
        else if (report.status !== 'unknown' && reportAgeLabel(report, now, area.location.timeZone) === 'stale') counts.stale++;
        else counts.unverified++;
    }
    return counts;
}

const feedLabels = {
    checking: 'Checking feed…',
    unavailable: 'Feed unavailable',
    partial: 'Snapshot unavailable',
    available: 'Feed reachable',
};

function conditionsFeedState({ feed, feedStatus }: SkiConditions): keyof typeof feedLabels {
    if (feedStatus !== 'available') return feedStatus;
    const { manifest, reports, forecasts } = feed;
    if (!manifest) return 'unavailable';
    if ((manifest.reports && manifest.reports !== reports?.file) ||
        (manifest.forecasts && manifest.forecasts !== forecasts?.file)) return 'partial';
    return 'available';
}

function snapshotSource(file: string | undefined, expected: string | undefined, feedStatus: SkiConditions['feedStatus']) {
    if (!file) return 'Bundled';
    return feedStatus === 'available' && file === expected ? 'Published' : 'Last verified';
}

function SnapshotTime({ value }: { value: string }) {
    return <time dateTime={value}>{timestamp.format(new Date(value))}</time>;
}

function LiveConditions({ conditions }: { conditions: SkiConditions }) {
    const { feed, feedStatus, reportsGeneratedAt, forecastsGeneratedAt } = conditions;
    const { manifest, reports, forecasts } = feed;
    const feedState = conditionsFeedState(conditions);
    const counts = countConditions(conditions);
    const metrics = [
        { label: 'Current operating reports', count: counts.skiing + counts.closed,
            detail: `${number.format(counts.skiing)} open or limited · ${number.format(counts.closed)} closed` },
        { label: 'Stale or unverified reports', count: counts.stale + counts.unverified,
            detail: `${number.format(counts.stale)} stale · ${number.format(counts.unverified)} unverified` },
        { label: 'Areas without a report', count: counts.missing },
        { label: 'Current forecasts', count: counts.forecasts },
    ];

    return <section className="ski-admin-section" aria-labelledby="ski-admin-conditions">
        <div className="ski-admin-feed-heading">
            <h3 id="ski-admin-conditions">Live conditions</h3>
            <span role="status" className="ski-admin-feed-state" data-state={feedState}>{feedLabels[feedState]}</span>
        </div>
        <dl className="ski-admin-counts">
            {metrics.map(({ label, count, detail }) => <div key={label}>
                <dt>{label}</dt>
                <dd><strong>{number.format(count)}</strong>{detail && <small>{detail}</small>}</dd>
            </div>)}
        </dl>
        <p className="ski-admin-note">Operating reports use each area’s local ski day.</p>
        <dl className="ski-admin-snapshots">
            <div>
                <dt>Last feed publication</dt>
                <dd>{manifest ? <SnapshotTime value={manifest.updatedAt} /> : feedState === 'checking' ? 'Waiting for feed' : 'Unavailable'}</dd>
            </div>
            <div>
                <dt>Reports snapshot</dt>
                <dd><span>{snapshotSource(reports?.file, manifest?.reports, feedStatus)}</span><SnapshotTime value={reportsGeneratedAt} /></dd>
            </div>
            <div>
                <dt>Forecasts snapshot</dt>
                <dd><span>{snapshotSource(forecasts?.file, manifest?.forecasts, feedStatus)}</span><SnapshotTime value={forecastsGeneratedAt} /></dd>
            </div>
        </dl>
    </section>;
}

function CoverageSection({ id, title, total, rows, note }: {
    id: string; title: string; total: number; rows: readonly CoverageRow[]; note?: string;
}) {
    return <section className="ski-admin-section" aria-labelledby={id}>
        <h3 id={id}>{title}</h3>
        {note && <p className="ski-admin-note">{note}</p>}
        <ul className="ski-admin-coverage">
            {rows.map(({ label, count }) => <li key={label}>
                <div><span>{label}</span><span>{number.format(count)} / {number.format(total)}</span></div>
                <span aria-hidden="true" className="ski-admin-coverage-track">
                    <span style={{ inlineSize: `${total ? count / total * 100 : 0}%` }} />
                </span>
            </li>)}
        </ul>
    </section>;
}

function DrivingCoverage() {
    const driving = useSkiDriving(true, 'all');
    const catalog = driving.catalog;
    const approaches = catalog ? Object.values(catalog.approaches).flat() : [];
    const arrivals = catalog ? Object.values(catalog.arrivals) : [];
    const unmappedLots = [...skiResortAccess].reduce((count, [area, access]) => count + (access.parking ?? [])
        .filter(lot => !arrivals.some(arrival => arrival.areaId === area && arrival.parkingRecord === lot.name)).length, 0);
    const labels = { current: 'Current', stale: 'Stale', unavailable: 'Unavailable', unconfigured: 'Official links only', checking: 'Checking…' };
    return <section aria-labelledby="ski-admin-driving" aria-busy={!catalog && !driving.catalogFailed}>
        <h3 id="ski-admin-driving">Driving coverage</h3>
        {catalog ? <p>{number.format(approaches.length)} approaches · {number.format(approaches.filter(route => route.segments?.length).length)} with a matchable road section ·
            {' '}{number.format(arrivals.length)} mapped entrances · {number.format(unmappedLots)} parking records without a mapped entrance</p>
            : <p>{driving.catalogFailed ? 'Driving catalog unavailable.' : 'Loading driving catalog…'}</p>}
        <ul className="ski-driving-list">
            {drivingProviders.map(provider => {
                const reports = drivingReports(driving, provider);
                const cameras = drivingCameras(driving, provider);
                const feed = driving.feed.providers[provider];
                return <li key={provider}>
                    <a href={drivingProviderSources[provider]}>{drivingProviderNames[provider]}</a> · {labels[roadReportState(driving, provider)]}
                    <p className="ski-driving-note">
                        {feed?.reports && <>Last checked <SnapshotTime value={feed.reports.data.checkedAt} /> · </>}
                        {reports.filter(report => report.state === 'stale').length} stale of {reports.length} reports · {cameras.length} cameras
                        {cameras.length > 0 && !cameras[0].available && ' (last verified)'}
                    </p>
                </li>;
            })}
        </ul>
    </section>;
}

export default function SkiDataStatus({ conditions }: { conditions: SkiConditions }) {
    const total = skiAreas.length;
    return <div className="ski-admin">
        <p>{number.format(total)} ski areas across {number.format(countries)} countries.</p>
        <LiveConditions conditions={conditions} />
        <DrivingCoverage />
        <div className="ski-admin-coverage-grid">
            <CoverageSection id="ski-admin-mountain" title="Mountain statistics" total={downhillAreas.length} rows={mountainCoverage}
                note={`${number.format(downhillAreas.length)} downhill areas, including areas with Nordic trails.`} />
            <CoverageSection id="ski-admin-catalog" title="Catalog records" total={total} rows={catalogCoverage} />
            <CoverageSection id="ski-admin-visitor" title="Map and visitor information" total={total} rows={visitorCoverage} />
        </div>
    </div>;
}
