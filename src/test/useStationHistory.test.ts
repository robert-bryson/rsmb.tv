import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStationHistory } from '../features/temperatures/hooks/useStationHistory';
import { jsonFetchResponse } from './helpers/fetch';

describe('useStationHistory', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it.each([
        [2, '2022-02-28'],
        [5, '2019-02-28'],
        [4, '2020-02-29'],
    ])('uses a valid start date for a %s-year history on leap day', async (years, expected) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2024-02-29T12:00:00Z'));
        const fetchMock = vi.fn().mockResolvedValue(jsonFetchResponse({ data: [] }));
        vi.stubGlobal('fetch', fetchMock);
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1, years));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ sdate: expected, edate: '2024-02-29' });
    });

    it('converts missing and invalid observations to null instead of NaN', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonFetchResponse({
            meta: { name: 'Test station' },
            data: [
                ['2026-10-20', '75', '42.5', '0'],
                ['2026-10-21', 'M', 'T', ''],
                ['2026-10-22', 'invalid', 'Infinity', '12invalid'],
            ],
        })));
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.history?.data).toEqual([
            { date: '2026-10-20', maxt: 75, mint: 42.5, pcpn: 0 },
            { date: '2026-10-21', maxt: null, mint: null, pcpn: null },
            { date: '2026-10-22', maxt: null, mint: null, pcpn: null },
        ]);
    });

    it.each([
        ['null response', null],
        ['non-object response', []],
        ['non-list observations', { data: {} }],
        ['non-list observation row', { data: [{ date: '2026-10-20' }] }],
        ['non-string observation date', { data: [[123, '75', '50', '0']] }],
        ['invalid calendar date', { data: [['2026-02-30', '75', '50', '0']] }],
        ['non-object metadata', { meta: 'Station' }],
        ['non-text station name', { meta: { name: { label: 'Station' } } }],
        ['invalid coordinates', { meta: { ll: ['west', 40] } }],
        ['out-of-range coordinates', { meta: { ll: [-122, 95] } }],
        ['non-number elevation', { meta: { elev: {} } }],
        ['non-list station identifiers', { meta: { sids: '123 COOP' } }],
        ['non-text server error', { error: { message: 'Unavailable' } }],
    ])('rejects malformed station history: %s', async (_description, payload) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonFetchResponse(payload)));
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.history).toBeNull();
        expect(result.current.error).toMatch(/^Invalid station history data/);
    });

    it.each([undefined, null, {}, { uid: null, name: null, ll: null, state: null, elev: null, sids: null }])('retains defaults for missing metadata: %s', async meta => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonFetchResponse({ meta, data: null })));
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(42));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBeNull();
        expect(result.current.history).toEqual({
            meta: { uid: 42, name: 'Unknown', ll: [0, 0], state: '', elev: null, sids: [] },
            data: [],
        });
    });

    it('preserves valid metadata and tolerates absent or nonnumeric observations', async () => {
        const meta = { uid: 42, name: 'Test station', ll: [-122, 47], state: 'WA', elev: 120, sids: ['123 COOP'] };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonFetchResponse({
            meta,
            data: [
                ['2024-02-29'],
                ['2024-03-01', null, 'M', {}],
                ['2024-03-02', 75, 50, 0],
            ],
        })));
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(42));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBeNull();
        expect(result.current.history).toEqual({
            meta,
            data: [
                { date: '2024-02-29', maxt: null, mint: null, pcpn: null },
                { date: '2024-03-01', maxt: null, mint: null, pcpn: null },
                { date: '2024-03-02', maxt: 75, mint: 50, pcpn: 0 },
            ],
        });
    });

    it.each([
        [jsonFetchResponse({}, { ok: false, status: 503 }), 'ACIS returned 503'],
        [jsonFetchResponse({ error: 'Station unavailable' }), 'Station unavailable'],
        [jsonFetchResponse({}, { json: () => Promise.reject(new SyntaxError('Invalid JSON')) }), 'Invalid JSON'],
    ])('reports unsuccessful responses without publishing history', async (response, message) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.history).toBeNull();
        expect(result.current.error).toBe(message);
    });

    it('reports a useful error when a provider rejects without an Error object', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'));
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.history).toBeNull();
        expect(result.current.error).toBe('Failed to load station history');
    });

    it('retains the timeout reason when the response body aborts with a generic error', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => Promise.resolve(jsonFetchResponse({}, {
            json: () => new Promise((_resolve, reject) => {
                options.signal!.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
            }),
        }))));
        const { result } = renderHook(() => useStationHistory());
        await act(async () => result.current.fetch(1));
        await act(() => vi.advanceTimersByTimeAsync(30_000));

        expect(result.current.loading).toBe(false);
        expect(result.current.history).toBeNull();
        expect(result.current.error).toBe('Station history request timed out. Please try again.');
    });

    it('aborts a cleared request and resets its loading state', () => {
        const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
        vi.stubGlobal('fetch', fetchMock);
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1));
        expect(result.current.loading).toBe(true);
        const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
        act(() => result.current.clear());
        expect(signal.aborted).toBe(true);
        expect(result.current.loading).toBe(false);
        expect(result.current.history).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('ignores a response body that completes after the station is cleared', async () => {
        let resolveBody!: (payload: unknown) => void;
        const fetchMock = vi.fn().mockResolvedValue(jsonFetchResponse({}, {
            json: () => new Promise(resolve => { resolveBody = resolve; }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        const { result } = renderHook(() => useStationHistory());
        await act(async () => result.current.fetch(1));
        const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;

        act(() => result.current.clear());
        expect(signal.aborted).toBe(true);
        await act(async () => resolveBody({ data: [[123, '75', '50', '0']] }));

        expect(result.current.loading).toBe(false);
        expect(result.current.history).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('aborts replaced requests and cancels the active request on unmount', () => {
        const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
        vi.stubGlobal('fetch', fetchMock);
        const { result, unmount } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1));
        const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
        act(() => result.current.fetch(2));
        const secondSignal = fetchMock.mock.calls[1][1].signal as AbortSignal;
        expect(firstSignal.aborted).toBe(true);
        expect(secondSignal.aborted).toBe(false);
        unmount();
        expect(secondSignal.aborted).toBe(true);
    });

    it('times out a stalled request and reports an error', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true });
        })));
        const { result, unmount } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1));
        await act(() => vi.advanceTimersByTimeAsync(30_000));
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toMatch(/timed out/i);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('ignores a late response from a replaced station', async () => {
        let resolveFirst!: (response: Response) => void;
        vi.stubGlobal('fetch', vi.fn()
            .mockReturnValueOnce(new Promise<Response>(resolve => { resolveFirst = resolve; }))
            .mockResolvedValueOnce(jsonFetchResponse({ meta: { name: 'Second' }, data: [] })));
        const { result } = renderHook(() => useStationHistory());
        act(() => result.current.fetch(1));
        act(() => result.current.fetch(2));
        await waitFor(() => expect(result.current.history?.meta.name).toBe('Second'));
        await act(async () => { resolveFirst(jsonFetchResponse({ meta: { name: 'First' }, data: [] })); });
        expect(result.current.history?.meta.name).toBe('Second');
    });
});
