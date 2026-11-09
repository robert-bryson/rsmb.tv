import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache } from '../data/fetchCache';
import { useTornadoData } from '../features/tornadoes/hooks/useTornadoData';
import { jsonFetchResponse } from './helpers/fetch';
import type { AnnualTornadoSummary } from '../features/tornadoes/types';
import { makeNotableEvent } from './helpers/tornadoes';

const collection = { type: 'FeatureCollection', features: [] };
const annualSummary: AnnualTornadoSummary[] = Array.from({ length: 26 }, (_, index) => ({
    year: 2000 + index, count: 1, unknown: 0, ef0: 1, ef1: 0, ef2: 0, ef3: 0, ef4: 0, ef5: 0,
    ef1Plus: 0, ef2Plus: 0, deaths: 0, injuries: 0, trackMiles: 1, medianWidthYards: 1,
}));
const trendIndex = { version: 1, groups: annualSummary.map(row => ({
    year: row.year, state: 'MO', scale: 0, count: 1, deaths: 0, injuries: 0, trackMiles: 1, widths: [[1, 1]],
})) };

function metadataResponse(input: RequestInfo | URL) {
    return jsonFetchResponse(String(input).endsWith('annual-summary.json') ? annualSummary : []);
}

function deferredResponse() {
    let resolve!: (value: Response) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Response>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe('useTornadoData', () => {
    beforeEach(() => clearCache());
    afterEach(() => { clearCache(); vi.unstubAllGlobals(); });

    it('ignores malformed optional events and recovers through the map retry action', async () => {
        let repaired = false;
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('notable-events.json')) return jsonFetchResponse(repaired ? [makeNotableEvent()] : [{ lengthMiles: null }]);
            return url.includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input);
        }));
        const { result } = renderHook(() => useTornadoData({ startYear: 2025, endYear: 2025 }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.notableEvents).toEqual([]);
        expect(result.current.error).toBeNull();
        repaired = true;
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.notableEvents).toEqual([makeNotableEvent()]));
        expect(result.current.error).toBeNull();
    });

    it('loads chart aggregates independently without expanding geometry years', async () => {
        const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(String(input).endsWith('trend-index.json')
            ? jsonFetchResponse(trendIndex) : String(input).includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input)));
        vi.stubGlobal('fetch', fetchMock);
        const { result, rerender } = renderHook(({ loadTrends }) => useTornadoData({ startYear: 2025, endYear: 2025, loadTrends }), {
            initialProps: { loadTrends: false },
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('trend-index.json'))).toBe(false);
        rerender({ loadTrends: true });
        await waitFor(() => expect(result.current.trendIndex).toEqual(trendIndex));
        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/tracks/')).map(([url]) => String(url)))
            .toEqual(['https://data.rsmb.tv/tornadoes/tracks/2025.geojson']);
    });

    it('retries malformed chart aggregates while keeping geometry in the displayed range', async () => {
        let repaired = false;
        const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(String(input).endsWith('trend-index.json')
            ? jsonFetchResponse(repaired ? trendIndex : {})
            : String(input).includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input)));
        vi.stubGlobal('fetch', fetchMock);
        const { result } = renderHook(() => useTornadoData({ startYear: 2025, endYear: 2025, loadTrends: true }));
        await waitFor(() => expect(result.current.trendsError).toMatch(/tornado trend/i));
        expect(result.current.error).toBeNull();
        repaired = true;
        act(() => result.current.retryTrends());
        await waitFor(() => expect(result.current.trendIndex).toEqual(trendIndex));
        expect(result.current.trendsError).toBeNull();
        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/tracks/')).every(([url]) => String(url).endsWith('/2025.geojson'))).toBe(true);
    });

    it('keeps the map ready while aggregates load and does not refetch geometry on chart retry', async () => {
        const delayed = deferredResponse();
        let repaired = false;
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('trend-index.json')) return repaired ? Promise.resolve(jsonFetchResponse(trendIndex)) : delayed.promise;
            return Promise.resolve(url.includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input));
        });
        vi.stubGlobal('fetch', fetchMock);
        const { result, rerender } = renderHook(({ loadTrends }) => useTornadoData({ startYear: 2025, endYear: 2025, loadTrends }), {
            initialProps: { loadTrends: true },
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.trendsLoading).toBe(true);
        expect(result.current.error).toBeNull();
        await act(async () => delayed.resolve(jsonFetchResponse({ version: 1, groups: [] })));
        await waitFor(() => expect(result.current.trendsError).toMatch(/annual summary/i));
        rerender({ loadTrends: false });
        expect(result.current.trendsError).toBeNull();
        expect(result.current.trendsLoading).toBe(false);
        repaired = true;
        rerender({ loadTrends: true });
        act(() => result.current.retryTrends());
        await waitFor(() => expect(result.current.trendIndex).toEqual(trendIndex));
        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/tracks/'))).toHaveLength(1);
        expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('notable-events.json'))).toHaveLength(1);
    });

    it('refreshes both publication files when their cached generations disagree', async () => {
        let repaired = false;
        const updatedAnnual = annualSummary.map(row => row.year === 2025 ? { ...row, count: 2, ef0: 2, trackMiles: 2 } : row);
        const updatedIndex = { version: 1, groups: trendIndex.groups.map(group => group.year === 2025
            ? { ...group, count: 2, trackMiles: 2, widths: [[1, 2]] } : group) };
        const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(jsonFetchResponse(
            String(input).endsWith('annual-summary.json') ? repaired ? updatedAnnual : annualSummary
                : String(input).endsWith('trend-index.json') ? updatedIndex
                    : String(input).includes('/tracks/') ? collection : [],
        )));
        vi.stubGlobal('fetch', fetchMock);
        const { result } = renderHook(() => useTornadoData({ startYear: 2025, endYear: 2025, loadTrends: true }));
        await waitFor(() => expect(result.current.trendsError).toMatch(/annual summary/i));
        expect(result.current.trendIndex).toBeNull();
        expect(result.current.error).toBeNull();
        repaired = true;
        act(() => result.current.retryTrends());
        await waitFor(() => expect(result.current.trendIndex).toEqual(updatedIndex));
        expect(result.current.annualSummary.find(row => row.year === 2025)?.count).toBe(2);
        expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('annual-summary.json'))).toHaveLength(2);
        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/tracks/'))).toHaveLength(1);
    });

    it('preserves usable map metadata when a chart retry metadata refresh fails', async () => {
        const refresh = deferredResponse();
        let annualRequests = 0;
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('annual-summary.json')) return ++annualRequests === 1 ? Promise.resolve(jsonFetchResponse(annualSummary)) : refresh.promise;
            if (url.endsWith('trend-index.json')) return Promise.reject(new Error('Chart archive unavailable'));
            return Promise.resolve(jsonFetchResponse(url.includes('/tracks/') ? collection : []));
        }));
        const { result } = renderHook(() => useTornadoData({ startYear: 2025, endYear: 2025, loadTrends: true }));
        await waitFor(() => expect(result.current.trendsError).toBe('Chart archive unavailable'));
        const tracks = result.current.tracks;
        act(() => result.current.retryTrends());
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.trendsLoading).toBe(true);
        await act(async () => refresh.reject(new Error('Metadata refresh unavailable')));
        await waitFor(() => expect(result.current.trendsError).toBe('Metadata refresh unavailable'));
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.tracks).toBe(tracks);
    });

    it('keeps chart loading independent of a geometry failure', async () => {
        const delayed = deferredResponse();
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/tracks/')) return Promise.reject(new Error('Geometry unavailable'));
            if (url.endsWith('trend-index.json')) return delayed.promise;
            return Promise.resolve(metadataResponse(input));
        }));
        const { result } = renderHook(() => useTornadoData({ startYear: 2025, endYear: 2025, loadTrends: true }));
        await waitFor(() => expect(result.current.error).toBe('Geometry unavailable'));
        expect(result.current.trendsLoading).toBe(true);
        await act(async () => delayed.resolve(jsonFetchResponse(trendIndex)));
        await waitFor(() => expect(result.current.trendIndex).toEqual(trendIndex));
        expect(result.current.trendsLoading).toBe(false);
        expect(result.current.trendsError).toBeNull();
        expect(result.current.error).toBe('Geometry unavailable');
    });

    it.each(['success', 'failure'])('ignores an obsolete aggregate %s after Trends is disabled', async outcome => {
        const delayed = deferredResponse();
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input).endsWith('trend-index.json')
            ? delayed.promise : Promise.resolve(String(input).includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input))));
        const { result, rerender } = renderHook(({ loadTrends }) => useTornadoData({ startYear: 2025, endYear: 2025, loadTrends }), {
            initialProps: { loadTrends: true },
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        rerender({ loadTrends: false });
        await act(async () => {
            if (outcome === 'success') delayed.resolve(jsonFetchResponse(trendIndex));
            else delayed.reject(new Error('Obsolete aggregate failure'));
        });
        expect(result.current.trendIndex).toBeNull();
        expect(result.current.trendsError).toBeNull();
        expect(result.current.trendsLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('does not request warning analytics until requested', async () => {
        const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(String(input).includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input)));
        vi.stubGlobal('fetch', fetchMock);
        const { result, rerender } = renderHook(({ loadWarnings }) => useTornadoData({ startYear: 2020, endYear: 2020, loadWarnings }), {
            initialProps: { loadWarnings: false },
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('warning-summary.json'))).toBe(false);
        rerender({ loadWarnings: true });
        await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('warning-summary.json'))).toBe(true));
    });

    it('does not block required metadata on optional analytics or notable events', async () => {
        const optional = deferredResponse();
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (/warning-summary|notable-events/.test(url)) return optional.promise;
            return Promise.resolve(url.includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input));
        }));
        const { result } = renderHook(() => useTornadoData({ startYear: 2020, endYear: 2020, loadWarnings: true }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeNull();
        await act(async () => optional.resolve(jsonFetchResponse([])));
    });

    it('waits for published years and clamps a requested year to available data', async () => {
        const metadata = deferredResponse();
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('annual-summary.json')) return metadata.promise;
            return Promise.resolve(jsonFetchResponse(url.includes('/tracks/') ? collection : []));
        });
        vi.stubGlobal('fetch', fetchMock);
        const { result } = renderHook(() => useTornadoData({ startYear: 2099, endYear: 2099 }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/tracks/'))).toBe(false);
        await act(async () => metadata.resolve(jsonFetchResponse([{ ...annualSummary[0], year: 2020 }])));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/tracks/')).map(([url]) => String(url))).toEqual([
            'https://data.rsmb.tv/tornadoes/tracks/2020.geojson',
        ]);
    });

    it('retries a failed track request without requiring a page reload', async () => {
        let failed = true;
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/tracks/') && failed) return Promise.reject(new Error('Temporarily unavailable'));
            return Promise.resolve(url.includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input));
        }));
        const { result } = renderHook(() => useTornadoData({ startYear: 2020, endYear: 2020 }));
        await waitFor(() => expect(result.current.error).toBe('Temporarily unavailable'));
        failed = false;
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeNull();
        expect(result.current.tracks).toEqual(expect.objectContaining(collection));
        expect(result.current.tracks?.metadata).not.toHaveProperty('generatedAt');
    });

    it('bounds historical downloads and stops queued work when the selected range changes', async () => {
        const pending = new Map<number, ReturnType<typeof deferredResponse>>();
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const year = String(input).match(/\/tracks\/(\d+)\.geojson/)?.[1];
            if (!year) return Promise.resolve(metadataResponse(input));
            if (year === '2025') return Promise.resolve(jsonFetchResponse(collection));
            const response = deferredResponse();
            pending.set(Number(year), response);
            return response.promise;
        });
        vi.stubGlobal('fetch', fetchMock);
        const { result, rerender } = renderHook(({ start, end }) => useTornadoData({ startYear: start, endYear: end }), {
            initialProps: { start: 2000, end: 2010 },
        });
        await waitFor(() => expect(pending.size).toBeGreaterThan(0));
        expect(pending.size).toBeLessThanOrEqual(6);
        const initialCount = pending.size;
        rerender({ start: 2025, end: 2025 });
        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => { for (const response of pending.values()) response.resolve(jsonFetchResponse(collection)); });
        expect(pending.size).toBe(initialCount);
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/2025.geojson'))).toBe(true);
    });

    it.each(['tracks', 'track-points'])('preserves %s errors when the other data request succeeds', async failedType => {
        const successful = deferredResponse();
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes(`/${failedType}/`)) return Promise.reject(new Error(`${failedType} unavailable`));
            if (/\/(tracks|track-points)\//.test(url)) return successful.promise;
            return Promise.resolve(metadataResponse(input));
        }));
        const { result } = renderHook(() => useTornadoData({ startYear: 2020, endYear: 2020, loadPoints: true }));
        await waitFor(() => expect(result.current.error).toBe(`${failedType} unavailable`));
        await act(async () => successful.resolve(jsonFetchResponse(collection)));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(`${failedType} unavailable`);
    });

    it('hides density errors when density mode is disabled', async () => {
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/track-points/')) return Promise.reject(new Error('Density unavailable'));
            return Promise.resolve(url.includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input));
        }));
        const { result, rerender } = renderHook(({ loadPoints }) => useTornadoData({ startYear: 2020, endYear: 2020, loadPoints }), {
            initialProps: { loadPoints: true },
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('Density unavailable');
        rerender({ loadPoints: false });
        expect(result.current.error).toBeNull();
    });

    it('does not retain errors from a previous year range', async () => {
        const next = deferredResponse();
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/tracks/2020')) return Promise.reject(new Error('Old year unavailable'));
            if (url.includes('/tracks/2021')) return next.promise;
            return Promise.resolve(metadataResponse(input));
        }));
        const { result, rerender } = renderHook(({ year }) => useTornadoData({ startYear: year, endYear: year }), {
            initialProps: { year: 2020 },
        });
        await waitFor(() => expect(result.current.error).toBe('Old year unavailable'));
        rerender({ year: 2021 });
        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBeNull();
        await act(async () => next.resolve(jsonFetchResponse(collection)));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeNull();
    });
});

describe('review regressions: published tornado metadata', () => {
    beforeEach(() => clearCache());
    afterEach(() => { clearCache(); vi.unstubAllGlobals(); });

    it.each([[], null, {}, [{ year: 2020 }], [{ ...annualSummary[0], count: -1 }],
        [{ ...annualSummary[0], year: 2099 }], [annualSummary[0], annualSummary[0]]])(
        'reports invalid metadata without guessing geometry URLs: %j', async metadata => {
            const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(jsonFetchResponse(
                String(input).endsWith('annual-summary.json') ? metadata : [],
            )));
            vi.stubGlobal('fetch', fetchMock);
            const { result } = renderHook(() => useTornadoData({ startYear: 2020, endYear: 2020 }));
            await waitFor(() => expect(result.current.error).toMatch(/annual summary/i));
            expect(result.current.loading).toBe(false);
            expect(fetchMock.mock.calls.some(([url]) => /\/(tracks|track-points)\//.test(String(url)))).toBe(false);
        },
    );

    it('orders valid metadata before exposing it to charts', async () => {
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(jsonFetchResponse(
            String(input).endsWith('annual-summary.json') ? [annualSummary[1], annualSummary[0]]
                : String(input).includes('/tracks/') ? collection : [],
        ))));
        const { result } = renderHook(() => useTornadoData({ startYear: 2000, endYear: 2001 }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.annualSummary.map(row => row.year)).toEqual([2000, 2001]);
    });

    it('recovers after the publisher repairs invalid metadata', async () => {
        let repaired = false;
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(
            String(input).endsWith('annual-summary.json') && !repaired ? jsonFetchResponse([])
                : String(input).includes('/tracks/') ? jsonFetchResponse(collection) : metadataResponse(input),
        )));
        const { result } = renderHook(() => useTornadoData({ startYear: 2020, endYear: 2020 }));
        await waitFor(() => expect(result.current.error).toMatch(/annual summary/i));
        repaired = true;
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeNull();
        expect(result.current.tracks).not.toBeNull();
    });
});
