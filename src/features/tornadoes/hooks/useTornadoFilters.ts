import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_END_YEAR, DEFAULT_START_YEAR } from '../constants';
import type { TornadoColorMode, TornadoMode, TornadoRegionPreset, TornadoScaleFilter } from '../types';

const SCALE_FILTERS = new Set<TornadoScaleFilter>(['all', 'ef0', 'ef1', 'ef2', 'ef3', 'ef4', 'ef5', 'ef1plus', 'ef2plus', 'ef3plus']);
const REGIONS = new Set<TornadoRegionPreset>(['conus', 'midwest', 'plains', 'dixie']);
const MODES = new Set<TornadoMode>(['tracks', 'density', 'trends']);
const COLOR_MODES = new Set<TornadoColorMode>(['scale', 'year', 'decade']);

function parseYear(value: string | null, fallback: number) {
    if (value === null || value === '') return fallback;
    const year = Number(value);
    return Number.isFinite(year) ? Math.round(year) : fallback;
}

function parseSetValue<T extends string>(value: string | null, allowed: Set<T>, fallback: T): T {
    return value && allowed.has(value as T) ? value as T : fallback;
}

export function useTornadoFilters() {
    const [searchParams, setSearchParams] = useSearchParams();
    const startYear = parseYear(searchParams.get('start'), DEFAULT_START_YEAR);
    const endYear = parseYear(searchParams.get('end'), DEFAULT_END_YEAR);
    const scaleFilter = parseSetValue(searchParams.get('scale'), SCALE_FILTERS, 'all');
    const region = parseSetValue(searchParams.get('region'), REGIONS, 'conus');
    const mode = parseSetValue(searchParams.get('mode'), MODES, 'tracks');
    const colorMode = parseSetValue(searchParams.get('color'), COLOR_MODES, 'scale');

    const updateParams = useCallback((updater: (next: URLSearchParams) => void) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            updater(next);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setYearRange = useCallback((start: number, end: number) => {
        const nextStart = Math.min(start, end);
        const nextEnd = Math.max(start, end);
        updateParams((next) => {
            if (nextStart === DEFAULT_START_YEAR) next.delete('start');
            else next.set('start', String(nextStart));
            if (nextEnd === DEFAULT_END_YEAR) next.delete('end');
            else next.set('end', String(nextEnd));
        });
    }, [updateParams]);

    const setScaleFilter = useCallback((value: TornadoScaleFilter) => {
        updateParams((next) => {
            if (value === 'all') next.delete('scale');
            else next.set('scale', value);
        });
    }, [updateParams]);

    const setRegion = useCallback((value: TornadoRegionPreset) => {
        updateParams((next) => {
            if (value === 'conus') next.delete('region');
            else next.set('region', value);
        });
    }, [updateParams]);

    const setMode = useCallback((value: TornadoMode) => {
        updateParams((next) => {
            if (value === 'tracks') next.delete('mode');
            else next.set('mode', value);
        });
    }, [updateParams]);

    const setColorMode = useCallback((value: TornadoColorMode) => {
        updateParams((next) => {
            if (value === 'scale') next.delete('color');
            else next.set('color', value);
        });
    }, [updateParams]);

    const setSelectedTrackId = useCallback((id: string | null) => {
        updateParams((next) => {
            if (id === null) next.delete('track');
            else next.set('track', id);
        });
    }, [updateParams]);

    const selectedTrackId = searchParams.get('track') ?? null;

    return {
        filters: { startYear, endYear, scaleFilter, region, mode, colorMode, selectedTrackId },
        setYearRange,
        setScaleFilter,
        setRegion,
        setMode,
        setColorMode,
        setSelectedTrackId,
    };
}