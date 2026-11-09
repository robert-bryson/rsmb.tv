import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TornadoTracks from '../pages/TornadoTracks';
import { clearCache, getCacheStats } from '../data/fetchCache';

vi.mock('../features/tornadoes/components/TornadoMap', () => ({
    TornadoMap: () => <output>Tornado renderer ready</output>,
}));
afterEach(() => { clearCache(); vi.unstubAllGlobals(); });

it('starts demanded metadata with normal priority without waiting for it to render the map shell', async () => {
    const responses: Array<(response: Response) => void> = [];
    const fetch = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(() => new Promise(resolve => responses.push(resolve)));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><TornadoTracks /></MemoryRouter>);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls.every(([, options]) => options?.priority === 'auto')).toBe(true);
    expect(await screen.findByText('Tornado renderer ready')).toBeVisible();
    await act(async () => { for (const resolve of responses) resolve(Response.json({ malformed: true })); });
    await waitFor(() => expect(getCacheStats().pendingRequests).toBe(0));
    expect(getCacheStats().entries).toBe(0);
    expect(screen.getByText('Tornado renderer ready')).toBeVisible();
});
