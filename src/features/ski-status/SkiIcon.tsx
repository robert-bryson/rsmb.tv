import { useState, type ComponentPropsWithRef } from 'react';

const paths = {
    back: 'm15 5-7 7 7 7',
    search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5.5-2 5 5',
    filter: 'M3 4h18l-7 8v6l-4 2v-8L3 4Z',
    share: 'M12 16V3m-4 4 4-4 4 4M7 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2',
    close: 'm6 6 12 12M18 6 6 18',
    check: 'm5 12 4 4L19 6',
    map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
    results: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    compare: 'M4 5h16v14H4zM4 10h16m-8 0v9',
    layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
    fit: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
    columns: 'M3 5h18v14H3zM9 5v14m6-14v14',
    download: 'M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5',
    sortAscending: 'M7 20V4m-4 4 4-4 4 4m3 2h7m-7 5h5m-5 5h3',
    sortDescending: 'M7 4v16m-4-4 4 4 4-4m3-12h3m-3 5h5m-5 5h7',
    ascending: 'M12 19V5m-5 5 5-5 5 5',
    descending: 'M12 5v14m-5-5 5 5 5-5',
} as const;

type IconName = keyof typeof paths;

export function SkiIcon({ name }: { name: IconName }) {
    return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" className="ski-icon">
        <path d={paths[name]} />
    </svg>;
}

interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'type' | 'aria-label' | 'title' | 'onKeyDown' | 'onBlur'> {
    icon: IconName;
    label: string;
    hint?: string;
    showLabel?: boolean;
    count?: number;
}

export function SkiIconButton({ icon, label, hint = label, className = '', showLabel, count, ...props }: IconButtonProps) {
    const [hideHint, setHideHint] = useState(false);
    return <button {...props} type="button" className={`ski-control ski-icon-button ${className}`} aria-label={label} title={hint}
        data-ski-hint={hideHint ? undefined : hint} onBlur={() => setHideHint(false)}
        onKeyDown={event => { if (event.key === 'Escape') setHideHint(true); }}>
        <SkiIcon name={icon} />
        {showLabel && <span className="ski-icon-button-label">{label}</span>}
        {count ? <span className="ski-filter-count" aria-hidden="true">{count}</span> : null}
    </button>;
}
