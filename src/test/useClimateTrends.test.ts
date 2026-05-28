import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useClimateTrends } from '../features/temperatures/hooks/useClimateTrends';
import { clearCache } from '../features/flights/utils/fetchCache';
import { jsonFetchResponse } from './helpers/fetch';

const trends = {
    source: 'test',
    description: 'test trends',
    totalHighs: 2,
    totalLows: 1,
    byDecade: [],
    byYear: [],
    rollingRatio: [],
};

describe('useClimateTrends', () => {
    beforeEach(() => {
        clearCache();
        vi.restoreAllMocks();
    });

    it('does not fetch while disabled', () => {
        globalThis.fetch = vi.fn();

        const { result } = renderHook(() => useClimateTrends({ enabled: false }));

        expect(result.current.loading).toBe(false);
        expect(result.current.trends).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('clears the prior error and shows loading when retried', async () => {
        let resolveRetry!: (value: Response) => void;
        globalThis.fetch = vi
            .fn()
            .mockRejectedValueOnce(new Error('Trend service unavailable'))
            .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRetry = resolve; }));

        const { result, rerender } = renderHook(
            ({ enabled }) => useClimateTrends({ enabled }),
            { initialProps: { enabled: true } },
        );

        await waitFor(() => expect(result.current.error).toBe('Trend service unavailable'));

        rerender({ enabled: false });
        expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

        rerender({ enabled: true });

        await waitFor(() => expect(result.current.loading).toBe(true));
        expect(result.current.error).toBeNull();

        resolveRetry(jsonFetchResponse(trends));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.trends).toEqual(trends);
    });
});