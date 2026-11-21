import type { SkiArea } from './catalog';
import { skiAreaExternalLinks, skiResortIcon } from './resortDetailsData';
import { SkiAssetIcon } from './SkiAssetIcon';
import { SkiIcon } from './SkiIcon';

export function SkiResortLinks({ area }: { area: SkiArea }) {
    const { maps, searchesMaps, wikipedia, article } = skiAreaExternalLinks(area);
    const mapLabel = searchesMaps ? 'Search Google Maps' : 'Google Maps';
    return <div className="ski-resort-links" aria-label="Resort links" role="group">
        <a className="ski-control ski-icon-button" href={maps} target="_blank" rel="noreferrer" aria-label={mapLabel} title={mapLabel}>
            <SkiAssetIcon urls={[skiResortIcon('google-maps')]} size={23} fallback={<SkiIcon name="map" />} />
        </a>
        {wikipedia && <a className="ski-control ski-icon-button" href={wikipedia} target="_blank" rel="noreferrer"
            aria-label="Wikipedia" title={`${article} on Wikipedia`}>
            <SkiAssetIcon urls={[skiResortIcon('wikipedia')]} size={22} className="rounded-sm" fallback={<SkiIcon name="results" />} />
        </a>}
    </div>;
}
