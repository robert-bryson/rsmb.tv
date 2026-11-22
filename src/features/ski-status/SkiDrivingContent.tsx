import { useId, useState, type ReactNode } from 'react';
import { drivingProviderNames, drivingTimeZone, type DrivingPoint } from '../../../shared/skiDriving';
import type { DrivingArrival } from '../../../shared/skiDrivingCatalog';
import { drivingCameraImage, drivingDirections, drivingProviderZones, drivingReportLabels, type DrivingCameraView, type DrivingFeature, type DrivingReportView } from './drivingView';
import { skiResortAccess } from './resortAccessData';

export function DrivingLink({ href, children }: { href: string; children: ReactNode }) {
    return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}

export function DrivingTime({ value, zone }: { value: string; zone: string }) {
    const instant = Date.parse(value);
    const text = new Intl.DateTimeFormat(undefined, {
        timeZone: drivingTimeZone(zone, instant), month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(instant);
    return <time dateTime={value}>{text}</time>;
}

export function DrivingReport({ report: { entry, state, provider } }: { report: DrivingReportView }) {
    const zone = drivingProviderZones[provider];
    const label = state === 'active' ? drivingReportLabels[entry.kind]
        : state === 'scheduled' ? `Scheduled ${drivingReportLabels[entry.kind].toLowerCase()}`
        : state === 'stale' ? 'Last reported' : 'Agency advisory';
    return <div className="ski-driving-report" data-status={state} data-kind={entry.kind}>
        <p className="ski-driving-report-heading"><strong>{label}</strong> · {entry.road}
            {entry.direction && ` · ${drivingDirections[entry.direction]}`}</p>
        <p>{entry.title}</p>
        {entry.mileposts && <p>Mileposts {entry.mileposts.join(' to ')}</p>}
        {entry.description && entry.description !== entry.title && <p className="ski-driving-report-text">{entry.description}</p>}
        {entry.startsAt && <p>Starts <DrivingTime value={entry.startsAt} zone={zone} /></p>}
        {entry.endsAt && <p>Agency end time <DrivingTime value={entry.endsAt} zone={zone} /></p>}
        <p className="ski-driving-note">
            {entry.observedAt ? <>Reported <DrivingTime value={entry.observedAt} zone={zone} /> · </> : <>Report time unknown · </>}
            <DrivingLink href={entry.source}>{drivingProviderNames[provider]}</DrivingLink>
            {provider === 'drivebc' && <> · <DrivingLink href="https://api.open511.gov.bc.ca/help">Open Government Licence – British Columbia</DrivingLink></>}
        </p>
    </div>;
}

export function DrivingCameraDetails({ camera: { entry, provider, available }, now }: { camera: DrivingCameraView; now: number }) {
    const [shown, setShown] = useState(false);
    const [failedImage, setFailedImage] = useState<string>();
    const id = useId();
    const image = provider === 'drivebc' && drivingCameraImage(entry, now, available);
    return <div className="ski-driving-camera">
        <p>{entry.road}{entry.view && ` · ${/^(north|south|east|west)$/.test(entry.view) ? 'Facing ' : ''}${entry.view}`}</p>
        {entry.imageUpdatedAt && <p className="ski-driving-note">Image updated <DrivingTime value={entry.imageUpdatedAt} zone={drivingProviderZones[provider]} /></p>}
        <div className="ski-driving-actions">
            <DrivingLink href={entry.source}>View on {drivingProviderNames[provider]}</DrivingLink>
            {image && <button type="button" className="ski-control" aria-expanded={shown} aria-controls={id}
                onClick={() => { setFailedImage(undefined); setShown(!shown); }}>{shown ? 'Hide image' : 'Show image'}</button>}
        </div>
        {image && <div id={id} hidden={!shown}>
            {shown && (failedImage === image ? <p role="status">Camera image unavailable.</p> : <figure>
                <img src={image} alt={entry.name} referrerPolicy="no-referrer" onError={() => setFailedImage(image)} />
                {entry.credit && <figcaption className="ski-driving-note">{entry.credit}</figcaption>}
            </figure>)}
        </div>}
    </div>;
}

function directionsUrl([lon, lat]: DrivingPoint) {
    return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: `${lat},${lon}`, travelmode: 'driving' })}`;
}

export function DrivingArrivalDetails({ arrival }: { arrival: DrivingArrival }) {
    const visitor = skiResortAccess.get(arrival.areaId);
    const lot = visitor?.parking?.find(lot => lot.name === arrival.parkingRecord);
    const shuttle = visitor?.shuttle;
    return <div className="ski-driving-arrival">
        {lot?.policy && <p>{lot.policy} <DrivingLink href={lot.policySource ?? lot.source}>Parking terms</DrivingLink></p>}
        {lot?.rates && <ul>{lot.rates.map(rate => <li key={`${rate.appliesTo}-${rate.amount}-${rate.currency}`}>
            {rate.appliesTo} · {rate.kind === 'minimum' ? 'From ' : rate.kind === 'maximum' ? 'Up to ' : ''}
            {new Intl.NumberFormat(undefined, { style: 'currency', currency: rate.currency }).format(rate.amount)}
        </li>)}</ul>}
        {shuttle && <p>{shuttle.description} <DrivingLink href={shuttle.source}>Shuttle information</DrivingLink></p>}
        {arrival.notes?.map(note => <p key={note.label}>{note.description} <DrivingLink href={note.source}>{note.label}</DrivingLink></p>)}
        <div className="ski-driving-actions">
            <DrivingLink href={directionsUrl(arrival.point)}>Get directions</DrivingLink>
            <DrivingLink href={arrival.source}>Official parking information</DrivingLink>
        </div>
    </div>;
}

export function DrivingFeatureDetails({ feature, now }: { feature: DrivingFeature; now: number }) {
    switch (feature.kind) {
        case 'camera': return <DrivingCameraDetails camera={feature.camera} now={now} />;
        case 'parking': return <DrivingArrivalDetails arrival={feature.arrival} />;
        case 'report': return <DrivingReport report={feature.report} />;
        case 'pass': return <>
            <p>{feature.pass.road} · <DrivingLink href={feature.pass.source}>Crossing source</DrivingLink></p>
            {feature.reports.length ? feature.reports.map(report => <DrivingReport key={report.entry.id} report={report} />)
                : <p className="ski-driving-note">Pass conditions unknown.</p>}
        </>;
    }
}
