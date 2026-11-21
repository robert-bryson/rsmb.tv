import type { ReactNode } from 'react';
import { skiArchiveAssetUrl, type SkiArchiveTrailMap } from '../../../shared/skiArchive';
import type { ResortAccess } from '../../../shared/skiResortAccess';
import { skiResortAccess } from './resortAccessData';
import { skiMapsSearch } from './resortDetailsData';

type LiftTickets = NonNullable<ResortAccess['liftTickets']>;
type Price = LiftTickets['rates'][number];
type WebcamRecords = NonNullable<ResortAccess['webcams']>;
type TrailMap = NonNullable<ResortAccess['trailMaps']>[number] & { archive?: SkiArchiveTrailMap };
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function CheckedDate({ date }: { date: string }) {
    return <span>Checked <time dateTime={date}>{dateFormat.format(Date.parse(date))}</time></span>;
}

function VisitorLink({ href, children }: { href: string; children: ReactNode }) {
    return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}

function LocationLink({ coordinates: [longitude, latitude], children }: { coordinates: [number, number]; children: ReactNode }) {
    return <VisitorLink href={skiMapsSearch(`${latitude},${longitude}`)}>{children}</VisitorLink>;
}

function VisitorGroup({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
    return <details className="ski-visitor-group">
        <summary>
            <span className="font-medium">{title}</span>
            {summary && <>{' '}<span className="ski-visitor-summary">{summary}</span></>}
        </summary>
        <div className="ski-visitor-body">{children}</div>
    </details>;
}

function currencyAmount(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

function rateLabel({ amount, kind }: Price, currency: string) {
    const value = amount === 0 ? 'Free' : currencyAmount(amount, currency);
    if (kind === 'minimum') return `From ${value}`;
    if (kind === 'maximum') return `Up to ${value}`;
    return value;
}

function rateSummary(tickets: LiftTickets) {
    const { rates, currency } = tickets;
    if (rates.length === 1) return rateLabel(rates[0], currency);
    if (rates.some(rate => rate.kind)) return `${rates.length} published rates`;
    const amounts = rates.map(rate => rate.amount);
    const low = Math.min(...amounts);
    const high = Math.max(...amounts);
    const firstPrice = currencyAmount(low, currency);
    return low === high ? firstPrice : `${firstPrice}–${currencyAmount(high, currency)}`;
}

function Prices({ rates }: { rates: readonly (Price & { currency: string })[] }) {
    return <dl className="ski-visitor-prices">
        {rates.map(rate => <div key={`${rate.appliesTo}:${rate.amount}:${rate.currency}`}>
            <dt>{rate.appliesTo}</dt><dd>{rateLabel(rate, rate.currency)}</dd>
        </div>)}
    </dl>;
}

function TicketPrices({ tickets }: { tickets: LiftTickets }) {
    return <VisitorGroup title="Lift tickets" summary={rateSummary(tickets)}>
        <p className="font-medium">{tickets.product}</p>
        <Prices rates={tickets.rates.map(rate => ({ ...rate, currency: tickets.currency }))} />
        {tickets.note && <p className="ski-visitor-note">{tickets.note}</p>}
        <div className="ski-visitor-links">
            <VisitorLink href={tickets.source}>Ticket prices and terms</VisitorLink>
            <CheckedDate date={tickets.checkedOn} />
        </div>
    </VisitorGroup>;
}

function trailMapFormat(path: string | undefined) {
    if (!path) return 'Map page';
    const file = path.toLowerCase();
    if (file.endsWith('.pdf')) return 'PDF';
    return /\.(?:avif|png|jpe?g|webp)$/.test(file) ? 'Image' : 'Map file';
}

function mergeTrailMaps(published: readonly TrailMap[] = [], archived: readonly SkiArchiveTrailMap[] = []) {
    const matched = new Set<SkiArchiveTrailMap>();
    const maps = published.map(map => {
        const archive = archived.find(copy => copy.source === (map.assetUrl ?? map.source)
            && (!map.season || copy.edition === map.season));
        if (archive) matched.add(archive);
        return { ...map, archive };
    });
    for (const archive of archived) {
        if (matched.has(archive)) continue;
        const { source, checkedOn, coverage, edition } = archive;
        maps.push({ source, checkedOn, coverage, season: edition === 'undated' ? undefined : edition, archive });
    }
    return maps;
}

function TrailMaps({ maps, checkedOn }: { maps: readonly TrailMap[]; checkedOn?: string }) {
    return <VisitorGroup title="Trail maps" summary={`${maps.length} ${maps.length === 1 ? 'map' : 'maps'}`}>
        <ul className="ski-visitor-list">{maps.map(({ assetUrl, source, coverage, season, archive, note, checkedOn: mapDate }) => {
            const href = archive ? skiArchiveAssetUrl(archive) : assetUrl ?? source;
            const filename = archive?.relativePath ?? (assetUrl && new URL(assetUrl).pathname);
            const edition = archive?.edition ?? season;
            return <li key={`${assetUrl ?? source}:${coverage}:${season ?? ''}`}>
                <VisitorLink href={href}>{coverage}</VisitorLink>
                <p className="ski-visitor-note">{trailMapFormat(filename)} · {edition && edition !== 'undated' ? `${edition} edition` : 'Edition undated'}
                    {archive && ' · NAS copy'}</p>
                {note && <p className="ski-visitor-note">{note}</p>}
                <div className="ski-visitor-links">
                    {(archive || assetUrl && assetUrl !== source) && <VisitorLink href={source}>Map source</VisitorLink>}
                    {(archive?.checkedOn ?? mapDate) !== checkedOn && <CheckedDate date={archive?.checkedOn ?? mapDate} />}
                </div>
            </li>;
        })}</ul>
    </VisitorGroup>;
}

function GettingHere({ info }: { info: ResortAccess }) {
    const { lodges, mapPin, parking, parkingPolicy, shuttle, checkedOn } = info;
    if (!lodges && !mapPin && !parking && !parkingPolicy && !shuttle) return null;
    return <VisitorGroup title="Bases and parking" summary={mapPin?.base}>
        {mapPin && <section aria-label="Resort map point">
            <h4 className="font-medium">Resort map point</h4>
            <LocationLink coordinates={mapPin.coordinates}>{mapPin.base}</LocationLink>
            <div className="ski-visitor-links">
                <VisitorLink href={mapPin.source}>Map point source</VisitorLink>
                {mapPin.mapSource && mapPin.mapSource !== mapPin.source && <VisitorLink href={mapPin.mapSource}>Mapped location</VisitorLink>}
                {mapPin.checkedOn && mapPin.checkedOn !== checkedOn && <CheckedDate date={mapPin.checkedOn} />}
            </div>
        </section>}
        {lodges && <section aria-label="Base lodges">
            <h4 className="font-medium">Base lodges</h4>
            <ul className="ski-visitor-list">{lodges.map(lodge => <li key={`${lodge.name}:${lodge.source}`}>
                <VisitorLink href={lodge.source}>{lodge.name}</VisitorLink>
                {lodge.role && <p className="ski-visitor-note">{lodge.role}</p>}
                {lodge.address && <p className="ski-visitor-note">{lodge.address}</p>}
                <div className="ski-visitor-links">
                    {lodge.coordinates && <LocationLink coordinates={lodge.coordinates}>View lodge on map</LocationLink>}
                    {lodge.mapSource && lodge.mapSource !== lodge.source && <VisitorLink href={lodge.mapSource}>Mapped location</VisitorLink>}
                    {lodge.checkedOn && lodge.checkedOn !== checkedOn && <CheckedDate date={lodge.checkedOn} />}
                </div>
            </li>)}</ul>
        </section>}
        {(parking || parkingPolicy) && <section aria-label="Parking">
            <h4 className="font-medium">Parking</h4>
            {parkingPolicy && <>
                <p className="ski-visitor-note">{parkingPolicy.description}</p>
                <div className="ski-visitor-links">
                    <VisitorLink href={parkingPolicy.source}>Resort parking policy</VisitorLink>
                    {parkingPolicy.checkedOn && parkingPolicy.checkedOn !== checkedOn && <CheckedDate date={parkingPolicy.checkedOn} />}
                </div>
            </>}
            {parking && <ul className="ski-visitor-list">{parking.map(lot => <li key={`${lot.name}:${lot.source}`}>
                <VisitorLink href={lot.source}>{lot.name}</VisitorLink>
                {lot.location && <p className="ski-visitor-note">{lot.location}</p>}
                {lot.rates && <Prices rates={lot.rates} />}
                {lot.policy && <p className="ski-visitor-note">{lot.policy}</p>}
                {lot.note && <p className="ski-visitor-note">{lot.note}</p>}
                <div className="ski-visitor-links">
                    {lot.coordinates && <LocationLink coordinates={lot.coordinates}>View lot on map</LocationLink>}
                    {lot.mapSource && lot.mapSource !== lot.source && <VisitorLink href={lot.mapSource}>Mapped location</VisitorLink>}
                    {lot.rateSource && lot.rateSource !== lot.source && <VisitorLink href={lot.rateSource}>Parking rates</VisitorLink>}
                    {lot.policySource && lot.policySource !== lot.source && lot.policySource !== lot.rateSource &&
                        <VisitorLink href={lot.policySource}>Parking rules</VisitorLink>}
                    {lot.checkedOn && lot.checkedOn !== checkedOn && <CheckedDate date={lot.checkedOn} />}
                </div>
            </li>)}</ul>}
        </section>}
        {shuttle && <section aria-label="Shuttle">
            <h4 className="font-medium">Shuttle</h4>
            <p className="ski-visitor-note">{shuttle.description}</p>
            <div className="ski-visitor-links">
                <VisitorLink href={shuttle.source}>Shuttle details</VisitorLink>
                {shuttle.checkedOn && shuttle.checkedOn !== checkedOn && <CheckedDate date={shuttle.checkedOn} />}
            </div>
        </section>}
    </VisitorGroup>;
}

function cameraLink({ feedUrl, embedUrl, source }: WebcamRecords['cameras'][number], resortSource: string) {
    const link = feedUrl ?? embedUrl ?? source ?? resortSource;
    const url = new URL(link);
    if (url.hostname !== 'www.youtube.com' && url.hostname !== 'www.youtube-nocookie.com') return link;
    const video = /^\/embed\/([\w-]+)$/.exec(url.pathname)?.[1];
    return video ? `https://www.youtube.com/watch?v=${video}` : link;
}

function Webcams({ webcams, checkedOn }: { webcams: WebcamRecords; checkedOn: string }) {
    return <VisitorGroup title="Webcams" summary={`${webcams.cameras.length} ${webcams.cameras.length === 1 ? 'camera' : 'cameras'}`}>
        <div className="ski-visitor-links">
            <VisitorLink href={webcams.source}>Resort webcam page</VisitorLink>
            {webcams.checkedOn && webcams.checkedOn !== checkedOn && <CheckedDate date={webcams.checkedOn} />}
        </div>
        <ul className="ski-visitor-list">{webcams.cameras.map(camera => {
            const link = cameraLink(camera, webcams.source);
            const location = [...new Set([camera.location, camera.view].filter(Boolean))].join(' · ');
            return <li key={`${camera.name}:${link}`}>
                <VisitorLink href={link}>{camera.name}</VisitorLink>
                {location && <p className="ski-visitor-note">{location}</p>}
                {camera.availability && <p className="ski-visitor-note">{camera.availability}</p>}
            </li>;
        })}</ul>
    </VisitorGroup>;
}

export default function SkiVisitorInformation({ areaId, archivedMaps }: { areaId: string; archivedMaps?: readonly SkiArchiveTrailMap[] }) {
    const info = skiResortAccess.get(areaId);
    const maps = mergeTrailMaps(info?.trailMaps, archivedMaps);
    if (!info && !maps.length) return null;
    return <section className="ski-visitor-info" aria-labelledby="ski-visitor-heading">
        <div className="ski-visitor-header">
            <h3 id="ski-visitor-heading">Visitor information</h3>
            {info && <p className="ski-visitor-note">{info.season} season · <CheckedDate date={info.checkedOn} /></p>}
        </div>
        {maps.length > 0 && <TrailMaps maps={maps} checkedOn={info?.checkedOn} />}
        {info?.liftTickets && <TicketPrices tickets={info.liftTickets} />}
        {info && <GettingHere info={info} />}
        {info?.webcams && <Webcams webcams={info.webcams} checkedOn={info.checkedOn} />}
    </section>;
}
