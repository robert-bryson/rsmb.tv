import { formatArea, formatElevation, type SkiUnits } from './browse';
import { passNames, type PassFamily, type SkiArea } from './catalog';

export const markerModes = {
    default: 'Resort dots',
    pass: 'Pass access',
    acres: 'Skiable area',
    verticalFt: 'Vertical drop',
    summitFt: 'Summit elevation',
    highestLiftTerminalFt: 'Highest lift terminal',
};

export type MarkerMode = keyof typeof markerModes;

export function readMarkerMode(value: string | null): MarkerMode {
    return value && Object.hasOwn(markerModes, value) ? value as MarkerMode : 'default';
}

interface LegendEntry { label: string; color: string }

const defaultColor = '#67e8f9';
const unknown = { color: '#a1a1aa', label: 'Unknown' };
const passColors: Record<PassFamily, string> = {
    ikon: '#c084fc', epic: '#fb7185', indy: '#4ade80', 'mountain-collective': '#60a5fa',
};
const multiplePasses = { color: '#facc15', label: 'Multiple passes' };
const discountOnly = { color: '#fb923c', label: 'Discount only' };
const noRecordedPass = { color: unknown.color, label: 'No pass recorded' };
const numericColors = ['#bae6fd', '#38bdf8', '#818cf8', '#e879f9'] as const;
const thresholds = {
    acres: [250, 1_000, 2_500],
    verticalFt: [1_000, 2_000, 3_000],
    summitFt: [3_000, 6_000, 9_000],
    highestLiftTerminalFt: [3_000, 6_000, 9_000],
};

export function markerLegend(mode: MarkerMode, units: SkiUnits): LegendEntry[] {
    if (mode === 'default') return [];
    if (mode === 'pass') {
        return [...Object.entries(passColors).map(([family, color]) => ({ color, label: passNames[family as PassFamily] })),
            multiplePasses, discountOnly, noRecordedPass];
    }
    const cutoffs = thresholds[mode];
    const format = mode === 'acres' ? formatArea : formatElevation;
    return [...numericColors.map((color, index) => ({
        color,
        label: index === 0 ? `Under ${format(cutoffs[0], units)}` : `${format(cutoffs[index - 1], units)}${index === 3 ? ' and up' : ` to under ${format(cutoffs[index], units)}`}`,
    })), unknown];
}

export function markerColor(area: SkiArea, mode: MarkerMode): string {
    if (mode === 'default') return defaultColor;
    if (mode === 'pass') {
        const included = area.passes.filter(pass => pass.access === 'included');
        if (included.length > 1) return multiplePasses.color;
        if (included[0]) return passColors[included[0].family];
        return area.passes.some(pass => pass.access === 'discount') ? discountOnly.color : noRecordedPass.color;
    }
    const value = area[mode];
    if (value === undefined) return unknown.color;
    return numericColors[thresholds[mode].filter(cutoff => value >= cutoff).length];
}
