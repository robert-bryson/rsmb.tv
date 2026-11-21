import type { SkiArea } from './catalog';
import { skiAreaExternalLinks, skiResortIcon } from './resortDetailsData';

export function SkiResortLinks({ area }: { area: SkiArea }) {
    const { maps, searchesMaps, wikipedia, article } = skiAreaExternalLinks(area);
    const mapLabel = searchesMaps ? 'Search Google Maps' : 'Google Maps';
    return <div className="ski-resort-links" aria-label="Resort links" role="group">
        <a className="ski-control ski-icon-button" href={maps} target="_blank" rel="noreferrer" aria-label={mapLabel} title={mapLabel}>
            <img src={skiResortIcon('google-maps')} alt="" width={23} height={23} />
        </a>
        {wikipedia && <a className="ski-control ski-icon-button" href={wikipedia} target="_blank" rel="noreferrer"
            aria-label="Wikipedia" title={`${article} on Wikipedia`}>
            <img src={skiResortIcon('wikipedia')} alt="" width={22} height={22} className="rounded-sm" />
        </a>}
    </div>;
}
