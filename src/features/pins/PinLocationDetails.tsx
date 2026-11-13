import type { MapPin } from '../../../shared/worldPins';
import { formatRadius } from './geometry';
import { usePinDetails } from './usePinDetails';
import { compassDirection, formatElevation, pinMapLinks } from './locationDetails';

export function PinLocationDetails({ pin, unit }: { pin: MapPin; unit: 'mi' | 'km' }) {
    const details = usePinDetails(pin);
    const links = pinMapLinks(pin);
    const place = details.data?.nearestPlace;
    return <div className="pins-location-details">
        <nav className="pins-external-maps" aria-label="Open selected pin in another map">
            <a href={links.google} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
            <a href={links.osm} target="_blank" rel="noopener noreferrer">OpenStreetMap ↗</a>
        </nav>
        {details.loading && <p className="pins-selected-note" role="status">Loading elevation and nearby place…</p>}
        {details.error && <p className="pins-selected-note" role="status">Elevation and nearby place unavailable. <button type="button" className="pins-text-button" onClick={details.retry}>Retry location details</button></p>}
        {details.data && <>
            <dl><div><dt>Elevation</dt><dd>{details.data.elevationMeters === null ? 'No terrain sample available' : `${formatElevation(details.data.elevationMeters, unit)} above sea level`}</dd></div></dl>
            {place && <p className="pins-nearby-place"><span>Nearest listed place</span>
                <strong>{formatRadius(place.distanceMeters, unit)} {place.distanceMeters >= 10 ? `${compassDirection(place.bearingDegrees)} of ` : 'from '}<a href={`https://www.geonames.org/${place.geonameId}/`} target="_blank" rel="noopener noreferrer">{place.name} ↗</a></strong>
                <small>{[place.admin1Name, place.countryName].filter(Boolean).join(', ')} · straight-line distance</small>
            </p>}
            <p className="pins-selected-note pins-context-sources">Nearby towns: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> (500+ residents or administrative seats).
                {details.data.elevationDataset && <> Approximate terrain: <a href={details.data.elevationDataset === 'srtm30m' ? 'https://www.opentopodata.org/datasets/srtm/' : 'https://www.opentopodata.org/datasets/aster/'} target="_blank" rel="noopener noreferrer">{details.data.elevationDataset === 'srtm30m' ? 'NASA/USGS SRTM' : 'NASA/METI ASTER'}</a> via Open Topo Data.</>}
            </p>
        </>}
    </div>;
}
