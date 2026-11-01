import type { AtlasResultsView } from './tripAtlasBrowser';

const views = [
    { value: 'table', label: 'Table', help: 'Compare dates, riding days, mileage, and locations. Select column headings to sort.' },
    { value: 'cards', label: 'Cards', help: 'Browse trip photos, descriptions, and highlights.' },
] as const;

export function TripAtlasViewToggle({ value, onChange }: { value: AtlasResultsView; onChange: (view: AtlasResultsView) => void }) {
    return <fieldset className="atlas-results-toggle">
        <legend className="sr-only">Trip results view</legend>
        {views.map(view => <label key={view.value} className="atlas-view-option">
            <input type="radio" name="atlas-results-view" value={view.value} checked={value === view.value}
                aria-label={view.label} data-atlas-tooltip={`${view.label} — ${view.help}`}
                onChange={() => onChange(view.value)} />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {view.value === 'cards' ? <>
                    <rect x="4" y="3" width="16" height="18" rx="2" />
                    <path d="M4 11h16M8 15h8M8 18h5m-7-7 4-4 4 4" />
                </> : <>
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M3 9h18M3 14h18M10 4v16" />
                </>}
            </svg>
        </label>)}
    </fieldset>;
}
