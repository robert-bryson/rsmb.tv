import { useId, useState } from 'react';
import { drivingDistanceMeters, drivingPoint, drivingProviderNames, type DrivingPoint, type DrivingProvider } from '../../../shared/skiDriving';
import { drivingAreaProviders, drivingProviderSources, type DrivingApproach, type DrivingArrival } from '../../../shared/skiDrivingCatalog';
import type { SkiUnits } from './browse';
import { skiAreaMapPoint, type SkiArea } from './catalog';
import { DrivingArrivalDetails, DrivingCameraDetails, DrivingLink, DrivingReport, DrivingTime } from './SkiDrivingContent';
import { drivingApproachReports, drivingDirections, drivingProviderZones, nearestDrivingCameras, roadReportState } from './drivingView';
import { skiResortAccess } from './resortAccessData';
import type { SkiDriving } from './useSkiDriving';

function RoadReports({ data, area, approach, provider }: { data: SkiDriving; area: SkiArea; approach: DrivingApproach; provider: DrivingProvider }) {
    const { exact, nearby } = drivingApproachReports(data, area.id, skiAreaMapPoint(area), approach);
    const feedState = roadReportState(data, provider);
    const checkedAt = data.feed.providers[provider]?.reports?.data.checkedAt;
    const message = feedState === 'checking' ? 'Checking road reports…'
        : feedState === 'unconfigured' ? 'Live reports are unavailable for this corridor.' : 'Road status unknown.';
    return <section aria-label="Road reports" className="ski-driving-reports">
        <h3>Road reports</h3>
        {feedState === 'current' && provider === 'wsdot' && <p>Check WSDOT for current closures and restrictions.</p>}
        {feedState === 'current' && provider !== 'wsdot' && !exact.length && <p>{approach.segments?.length
            ? 'No matching reports for the mapped section and direction.'
            : 'Use the agency to check this approach.'}</p>}
        {feedState !== 'current' && <p role="status">{message}</p>}
        <p className="ski-driving-note">{checkedAt && <>Last successful check <DrivingTime value={checkedAt} zone={drivingProviderZones[provider]} /> · </>}
            <DrivingLink href={drivingProviderSources[provider]}>{drivingProviderNames[provider]} road information</DrivingLink></p>
        {exact.map(report => <DrivingReport key={report.entry.id} report={report} />)}
        {nearby.length > 0 && <details className="ski-driving-group">
            <summary>Nearby reports ({nearby.length})</summary>
            <p className="ski-driving-note">Check the agency’s location and direction before using these reports for this approach.</p>
            {nearby.map(report => <DrivingReport key={report.entry.id} report={report} />)}
        </details>}
    </section>;
}

function DriveDistance({ destination, units }: { destination: DrivingPoint; units: SkiUnits }) {
    const [origin, setOrigin] = useState('');
    const inputId = useId();
    const [lat, lon, ...extra] = origin.split(',').map(value => {
        const decimal = value.trim();
        return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(decimal) ? Number(decimal) : NaN;
    });
    const coords = drivingPoint.safeParse([lon, lat]);
    const distance = !extra.length && coords.success ? drivingDistanceMeters(coords.data, destination) : undefined;
    const unit = units === 'metric' ? 'kilometer' : 'mile';
    const number = new Intl.NumberFormat(undefined, { style: 'unit', unit, maximumFractionDigits: 1 });
    return <details className="ski-driving-group">
        <summary>Straight-line distance</summary>
        <label htmlFor={inputId}>Origin latitude, longitude</label>
        <input type="text" className="ski-input" id={inputId} placeholder="47.49, -121.79" value={origin} maxLength={80}
            onChange={event => setOrigin(event.target.value)} />
        <p className="ski-driving-note" aria-live="polite">{distance === undefined
            ? (origin.trim() ? 'Enter latitude and longitude in decimal degrees.' : 'Use coordinates from a map.')
            : `${number.format(distance / (units === 'metric' ? 1_000 : 1_609.344))} from the origin to this entrance (straight line).`}</p>
    </details>;
}

function Parking({ areaId, arrival, units }: { areaId: string; arrival?: DrivingArrival; units: SkiUnits }) {
    const visitor = skiResortAccess.get(areaId);
    const lots = visitor?.parking?.filter(lot => lot.name !== arrival?.parkingRecord) ?? [];
    if (!arrival && !lots.length) return null;
    return <section aria-label="Parking and directions">
        <h3>{arrival?.name ?? 'Parking'}</h3>
        {arrival && <>
            <DrivingArrivalDetails arrival={arrival} />
            <DriveDistance destination={arrival.point} units={units} />
        </>}
        {lots.length > 0 && <details className="ski-driving-group">
            <summary>{arrival ? 'More parking' : 'Published parking information'} ({lots.length})</summary>
            <ul className="ski-driving-list">{lots.map(lot => <li key={lot.name}>
                <DrivingLink href={lot.source}>{lot.name}</DrivingLink>
                {lot.policy && <p>{lot.policy}</p>}
            </li>)}</ul>
        </details>}
    </section>;
}

export default function SkiDrivingDetails({ area, units, data, approachId, onApproach, onFit }: {
    area: SkiArea; units: SkiUnits; data: SkiDriving; approachId?: string;
    onApproach: (id: string) => void;
    onFit: (approach: DrivingApproach) => void;
}) {
    const arrivalSelect = useId();
    const approachSelect = useId();
    if (!data.catalog) return <p role="status" className="ski-driving-note">
        {data.catalogFailed ? 'Driving information unavailable.' : 'Loading driving information…'}
    </p>;
    const routes = data.catalog.approaches[area.id] ?? [];
    const approach = routes.find(route => route.id === approachId) ?? routes[0];
    if (!approach) return <div className="ski-driving-body">
        <p>Approach records unavailable.</p>
        <Parking areaId={area.id} units={units} />
    </div>;

    const arrivals = data.catalog.arrivals;
    const arrival = approach.arrivalId ? arrivals[approach.arrivalId] : undefined;
    const destinationKey = (route: DrivingApproach) => route.arrivalId ?? route.to;
    const destinations = [...new Map(routes.map(route => [destinationKey(route), route])).values()];
    const routesToArrival = routes.filter(route => destinationKey(route) === destinationKey(approach));
    const provider = drivingAreaProviders[area.id];
    const cameras = nearestDrivingCameras(data, area.id, arrival?.point ?? skiAreaMapPoint(area), approach);
    const statusLinks = [...new Set(approach.statusUrls)].filter(url => !provider || url !== drivingProviderSources[provider]);

    return <div className="ski-driving-body">
        <div className="ski-driving-fields">
            {destinations.length > 1 && <div>
                <label htmlFor={arrivalSelect}>Arrival</label>
                <select className="ski-input" id={arrivalSelect} value={destinationKey(approach)} onChange={event => {
                    const options = routes.filter(route => destinationKey(route) === event.target.value);
                    const next = options.find(route => route.direction && route.direction === approach.direction) ?? options[0];
                    if (next) onApproach(next.id);
                }}>
                    {destinations.map(route => <option key={destinationKey(route)} value={destinationKey(route)}>
                        {route.arrivalId ? arrivals[route.arrivalId].name : route.to}
                    </option>)}
                </select>
            </div>}
            {routesToArrival.length > 1 ? <div>
                <label htmlFor={approachSelect}>Approach</label>
                <select className="ski-input" id={approachSelect} value={approach.id} onChange={event => onApproach(event.target.value)}>
                    {routesToArrival.map(route => <option key={route.id} value={route.id}>{route.from}</option>)}
                </select>
            </div> : <p><strong>Approach</strong> · {approach.from}</p>}
        </div>
        <ol className="ski-driving-roads" aria-label="Roads in travel order">
            {approach.roads.map((road, index) => <li key={`${road}-${index}`}>{road}</li>)}
        </ol>
        {approach.passIds?.length ? <ul className="ski-driving-list" aria-label="Mountain passes on this approach">
            {approach.passIds.map(id => <li key={id}><DrivingLink href={data.catalog!.passes[id].source}>{data.catalog!.passes[id].name}</DrivingLink></li>)}
        </ul> : <p className="ski-driving-note">{approach.passIds ? 'No named passes on this approach.' : 'Pass crossings need review.'}</p>}
        {approach.direction && <p className="ski-driving-note">{drivingDirections[approach.direction]} approach</p>}
        {arrival ? <div>
            <button type="button" className="ski-control" aria-controls="ski-results-map" onClick={() => onFit(approach)}>Show approach on map</button>
            <p className="ski-driving-note">Mapped roads to the entrance include {arrival.connector.roads.join(', ')}.</p>
        </div> : <p className="ski-driving-note">The final connector needs a verified entrance.</p>}
        {approach.restrictions?.length ? <section aria-label="Published seasonal rules">
            <h3>Seasonal restrictions</h3>
            <ul className="ski-driving-list">{approach.restrictions.map(rule => <li key={rule.description}>
                {rule.description} <DrivingLink href={rule.source}>Agency rules</DrivingLink>
            </li>)}</ul>
        </section> : null}
        {provider && <RoadReports data={data} area={area} approach={approach} provider={provider} />}
        <div className="ski-driving-actions">
            {statusLinks.map((url, index) => <DrivingLink key={url} href={url}>Official road source{statusLinks.length > 1 ? ` ${index + 1}` : ''}</DrivingLink>)}
            <DrivingLink href={approach.source}>Approach source</DrivingLink>
        </div>
        <Parking areaId={area.id} arrival={arrival} units={units} />
        {cameras.length > 0 && <details className="ski-driving-group">
            <summary>Road cameras ({cameras.length})</summary>
            <ul className="ski-driving-list">{cameras.map(camera => <li key={camera.entry.id}><h3>{camera.entry.name}</h3>
                <DrivingCameraDetails camera={camera} now={data.now} />
            </li>)}</ul>
        </details>}
    </div>;
}
