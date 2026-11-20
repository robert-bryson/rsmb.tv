import type { SkiArea } from './catalog';
import { skiAreaExternalLinks, skiResortIcon } from './resortDetailsData';

export function SkiResortLinks({ area }: { area: SkiArea }) {
    const { maps, wikipedia, article } = skiAreaExternalLinks(area);
    const wikiLabel = article ? 'Wikipedia' : 'Search Wikipedia';
    return <div className="ski-resort-links" aria-label="Resort links" role="group">
        <a className="ski-control ski-icon-button" href={maps} target="_blank" rel="noreferrer" aria-label="Google Maps" title="Google Maps">
            <img src={skiResortIcon('google-maps')} alt="" width={23} height={23} />
        </a>
        <a className="ski-control ski-icon-button" href={wikipedia} target="_blank" rel="noreferrer" aria-label={wikiLabel} title={wikiLabel}>
            <img src={skiResortIcon('wikipedia')} alt="" width={22} height={22} className="rounded-sm" />
        </a>
    </div>;
}
