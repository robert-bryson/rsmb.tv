import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { tripFactTag } from '../content/blogTags';
import type { BlogCountry } from '../content/blogRegions';

interface RegionFilterProps {
    countries: BlogCountry[];
    activeCountry: string;
    activeRegion: string;
    createUrl: (country?: string, region?: string) => string;
}

const pillClasses = 'max-w-full break-words rounded-full px-2.5 py-0.5 text-xs transition-colors';
const inactiveClasses = 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200';
const toggleClasses = 'shrink-0 px-1 py-0.5 text-xs text-violet-400 underline-offset-4 hover:underline';

function CountryRegions({ country, activeCountry, activeRegion, createUrl }: Omit<RegionFilterProps, 'countries'> & { country: BlogCountry }) {
    const [expanded, setExpanded] = useState(false);
    const [previewIndexes, setPreviewIndexes] = useState(() => country.regions.map((_, index) => index));
    const rowRef = useRef<HTMLDivElement>(null);
    const measurementRef = useRef<HTMLDivElement>(null);
    const listId = useId();
    const selectedIndex = country.regions.findIndex(region => (!activeCountry || activeCountry === country.code)
        && tripFactTag(region.name) === activeRegion);
    const visibleRegions = country.regions.filter((_, index) => expanded || previewIndexes.includes(index));
    const countryActive = !!country.code && activeCountry === country.code && !activeRegion;

    useLayoutEffect(() => {
        const row = rowRef.current;
        const measurement = measurementRef.current;
        if (!row || !measurement) return;

        function measure() {
            if (!row || !measurement || !row.clientWidth) return;
            const widths = Array.from(measurement.children, child => child.getBoundingClientRect().width);
            const gap = parseFloat(getComputedStyle(measurement).columnGap) || 0;
            const prefixWidth = widths[0] + widths[1] + gap;
            const regionWidths = widths.slice(2, -1);
            const allWidth = prefixWidth + regionWidths.reduce((sum, width) => sum + width + gap, 0);
            const indexes: number[] = [];
            if (allWidth <= row.clientWidth) {
                indexes.push(...country.regions.map((_, index) => index));
            } else {
                let usedWidth = prefixWidth + widths[widths.length - 1] + gap;
                // A selected region stays visible even when it is below the most-used regions.
                if (selectedIndex >= 0) {
                    indexes.push(selectedIndex);
                    usedWidth += regionWidths[selectedIndex] + gap;
                }
                for (let index = 0; index < regionWidths.length; index += 1) {
                    if (index === selectedIndex) continue;
                    const nextWidth = usedWidth + regionWidths[index] + gap;
                    if (nextWidth > row.clientWidth) break;
                    indexes.push(index);
                    usedWidth = nextWidth;
                }
                // On narrow screens, allow the toggle to wrap instead of hiding every region.
                if (!indexes.length && country.regions.length) indexes.push(0);
            }
            indexes.sort((a, b) => a - b);
            setPreviewIndexes(previous => previous.length === indexes.length
                && previous.every((index, position) => index === indexes[position]) ? previous : indexes);
        }

        measure();
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
        observer?.observe(row);
        observer?.observe(measurement);
        return () => observer?.disconnect();
    }, [country, selectedIndex]);

    return (
        <div ref={rowRef} id={listId} role="group" aria-label={country.name} className="relative flex flex-wrap items-baseline gap-2">
            <div ref={measurementRef} aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 flex gap-2 overflow-hidden whitespace-nowrap">
                <span className={`shrink-0 ${country.code ? pillClasses : 'text-sm font-medium'}`}>{country.name}</span>
                <span className="shrink-0">–</span>
                {country.regions.map(region => <span key={region.name} className={`shrink-0 ${pillClasses}`}>
                    {region.name}<span className="ml-1.5 tabular-nums">{region.count}</span>
                </span>)}
                <span className={toggleClasses}>See all ({country.regions.length})</span>
            </div>
            {country.code ? <Link
                to={createUrl(country.code)}
                aria-current={countryActive ? 'page' : undefined}
                className={`${pillClasses} ${countryActive ? 'bg-violet-600 text-zinc-100' : inactiveClasses}`}
            >
                {country.name}
            </Link> : <span className="text-sm font-medium text-zinc-300">{country.name}</span>}
            <span aria-hidden="true" className="text-zinc-600">–</span>
            {visibleRegions.map(region => {
                const key = tripFactTag(region.name);
                const active = (!activeCountry || activeCountry === country.code) && activeRegion === key;
                return (
                    <Link
                        key={key}
                        to={createUrl(country.code, key)}
                        aria-current={active ? 'page' : undefined}
                        className={`${pillClasses} ${active ? 'bg-violet-600 text-zinc-100' : inactiveClasses}`}
                    >
                        {region.name}
                        <span className="ml-1.5 tabular-nums opacity-70" aria-label={`${region.count} ${region.count === 1 ? 'post' : 'posts'}`}>
                            {region.count}
                        </span>
                    </Link>
                );
            })}
            {previewIndexes.length < country.regions.length && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={listId}
                    onClick={() => setExpanded(value => !value)}
                    className={toggleClasses}
                >
                    {expanded ? 'Show less' : `See all (${country.regions.length})`}
                </button>
            )}
            {country.regions.length === 0 && <span className="text-xs text-zinc-500">{country.count} {country.count === 1 ? 'post' : 'posts'}</span>}
        </div>
    );
}

export function PostRegionFilters(props: RegionFilterProps) {
    const active = !props.activeCountry && !props.activeRegion;
    return (
        <nav aria-label="Post regions" className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Regions</p>
                <Link
                    to={props.createUrl()}
                    aria-current={active ? 'page' : undefined}
                    className={`${pillClasses} ${active ? 'bg-violet-600 text-zinc-100' : inactiveClasses}`}
                >
                    All regions
                </Link>
            </div>
            {props.countries.map(country => <CountryRegions key={country.code} {...props} country={country} />)}
        </nav>
    );
}
