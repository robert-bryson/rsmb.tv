import { useId, useRef } from 'react';
import { SkiIcon, SkiIconButton } from './SkiIcon';

interface Props {
    count?: number;
    areaSelected: boolean;
    areaApplied: boolean;
    moving: boolean;
    checkingReports: boolean;
    onSearch: () => void;
    onClear: () => void;
}

export function SkiMapAreaControl({ count, areaSelected, areaApplied, moving, checkingReports, onSearch, onClear }: Props) {
    const id = useId();
    const searchButton = useRef<HTMLButtonElement>(null);
    const canSearch = count !== undefined && !moving && !areaApplied;
    const label = areaApplied ? 'Area applied' : areaSelected ? 'Update area' : 'Search this area';
    let detail = 'Uses the visible map';
    if (moving) detail = 'Map moving…';
    else if (count !== undefined) {
        if (checkingReports) detail = 'Checking reports…';
        else if (count === 0) detail = areaApplied ? 'No matches' : 'No matches in view';
        else {
            const matches = `${count.toLocaleString('en-US')} ${count === 1 ? 'match' : 'matches'}`;
            detail = areaApplied ? matches : `${matches} in view`;
        }
    }

    return <div className="ski-map-area" data-applied={areaApplied || undefined} role="group" aria-label="Map area">
        <button ref={searchButton} type="button" className="ski-control ski-area-search"
            aria-labelledby={`${id}-label`} aria-describedby={`${id}-detail`} aria-disabled={!canSearch}
            tabIndex={canSearch ? undefined : -1} onClick={() => { if (canSearch) onSearch(); }}>
            <SkiIcon name={areaApplied ? 'check' : 'search'} />
            <span className="ski-area-search-copy">
                <span id={`${id}-label`}>{label}</span>
                <span id={`${id}-detail`} className="ski-area-search-detail">{detail}</span>
            </span>
        </button>
        {areaSelected && <SkiIconButton icon="close" label="Clear map area" className="ski-area-clear" onClick={() => {
            searchButton.current?.focus({ preventScroll: true });
            onClear();
        }} />}
    </div>;
}
