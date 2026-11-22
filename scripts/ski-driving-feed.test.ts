import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrivingBulletin, DrivingCamera, DrivingManifest, DrivingProvider } from '../shared/skiDriving';
import { loadDrivingFeed, type DrivingFeed } from '../src/features/ski-status/driving-feed';

const checkedAt = '2026-11-22T12:00:00.000Z';
const point = [-122.959218, 50.116028] as [number, number];
const bulletin: DrivingBulletin = {
    id: 'closure', kind: 'closure', road: 'BC 99', direction: 'north', point, title: 'Highway closure', source: 'https://www.drivebc.ca/',
};
const camera: DrivingCamera = {
    id: '519', name: 'Whistler Village Gate', point, road: 'BC 99', source: 'https://www.drivebc.ca/cameras/519',
};
const emptyFeed: DrivingFeed = { providers: {} };
const disabled = { status: 'unconfigured' } as const;
const signal = new AbortController().signal;

function snapshot(kind: 'reports' | 'cameras', entries: (DrivingBulletin | DrivingCamera)[], provider: DrivingProvider = 'drivebc', time = checkedAt) {
    const body = JSON.stringify({ version: 1, provider, checkedAt: time, entries });
    const file = `${kind}-${createHash('sha256').update(body).digest('hex')}.json`;
    return { body, file, ref: { file, status: 'available' } as const };
}

function serve(manifest: DrivingManifest, files: Record<string, string> = {}) {
    fetcher.mockImplementation(async input => {
        const filename = new URL(String(input)).pathname.split('/').at(-1)!;
        if (filename === 'manifest.json') return Response.json(manifest);
        if (Object.hasOwn(files, filename)) return new Response(files[filename]);
        return new Response(null, { status: 404 });
    });
}

const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
    fetcher.mockReset();
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => vi.unstubAllGlobals());

describe('driving feed loading', () => {
    it('loads only requested providers and reuses verified snapshots by checksum', async () => {
        const reports = snapshot('reports', [bulletin]);
        const cameras = snapshot('cameras', [camera]);
        const wsdot = snapshot('reports', [], 'wsdot');
        serve({ version: 1, updatedAt: checkedAt, providers: {
            drivebc: { reports: reports.ref, cameras: cameras.ref },
            wsdot: { reports: wsdot.ref, cameras: disabled },
        } }, { [reports.file]: reports.body, [cameras.file]: cameras.body, [wsdot.file]: wsdot.body });

        const first = await loadDrivingFeed(emptyFeed, ['drivebc'], signal);
        expect(first.providers.drivebc).toMatchObject({
            reportsReady: true, camerasReady: true,
            reports: { data: { entries: [bulletin] } }, cameras: { data: { entries: [camera] } },
        });
        expect(first.providers.wsdot).toBeUndefined();
        expect(fetcher.mock.calls.map(([url]) => String(url).split('/').at(-1)))
            .toEqual(['manifest.json', reports.file, cameras.file]);
        expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error' });
        fetcher.mockClear();

        const refreshed = await loadDrivingFeed(first, ['drivebc', 'wsdot'], signal);
        expect(refreshed.providers.drivebc?.reports).toBe(first.providers.drivebc?.reports);
        expect(refreshed.providers.wsdot?.reportsReady).toBe(true);
        expect(fetcher.mock.calls.map(([url]) => String(url).split('/').at(-1))).toEqual(['manifest.json', wsdot.file]);
    });

    it('keeps last verified reports on a bad checksum and updates valid cameras independently', async () => {
        const reports = snapshot('reports', [bulletin]);
        serve({ version: 1, updatedAt: checkedAt, providers: { drivebc: { reports: reports.ref, cameras: disabled } } },
            { [reports.file]: reports.body });
        const first = await loadDrivingFeed(emptyFeed, ['drivebc'], signal);
        const updatedAt = '2026-11-22T12:05:00.000Z';
        const next = snapshot('reports', [], 'drivebc', updatedAt);
        const cameras = snapshot('cameras', [camera]);
        const manifest: DrivingManifest = { version: 1, updatedAt, providers: {
            drivebc: { reports: next.ref, cameras: cameras.ref },
        } };
        serve(manifest, { [next.file]: reports.body, [cameras.file]: cameras.body });

        const failed = await loadDrivingFeed(first, ['drivebc'], signal);
        expect(failed.providers.drivebc?.reports).toBe(first.providers.drivebc?.reports);
        expect(failed.providers.drivebc).toMatchObject({ reportsReady: false, camerasReady: true });

        serve(manifest, { [next.file]: next.body });
        const recovered = await loadDrivingFeed(failed, ['drivebc'], signal);
        expect(recovered.providers.drivebc).toMatchObject({ reportsReady: true, reports: { data: { entries: [] } } });
        expect(recovered.providers.drivebc?.cameras).toBe(failed.providers.drivebc?.cameras);
    });

    it('honors an unavailable provider and drops a snapshot when the manifest retires it', async () => {
        const reports = snapshot('reports', [bulletin]);
        serve({ version: 1, updatedAt: checkedAt, providers: { drivebc: {
            reports: { file: reports.file, status: 'unavailable' }, cameras: disabled,
        } } }, { [reports.file]: reports.body });
        const failed = await loadDrivingFeed(emptyFeed, ['drivebc'], signal);
        expect(failed.providers.drivebc).toMatchObject({ reportsReady: false, reports: { file: reports.file } });

        serve({ version: 1, updatedAt: '2026-11-22T12:05:00.000Z', providers: {} });
        const retired = await loadDrivingFeed(failed, ['drivebc'], signal);
        expect(retired.providers.drivebc?.reports).toBeUndefined();
    });

    it.each([
        snapshot('reports', [bulletin, bulletin]),
        snapshot('reports', [bulletin], 'wsdot'),
        snapshot('reports', [bulletin], 'drivebc', '2026-11-22T12:00:01.000Z'),
    ])('rejects snapshots with duplicate IDs, the wrong provider, or a future check', async ({ body, file, ref }) => {
        serve({ version: 1, updatedAt: checkedAt, providers: { drivebc: { reports: ref, cameras: disabled } } }, { [file]: body });
        const result = await loadDrivingFeed(emptyFeed, ['drivebc'], signal);
        expect(result.providers.drivebc?.reportsReady).toBe(false);
        expect(result.providers.drivebc?.reports).toBeUndefined();
    });

    it('rejects rollback, conflicting manifests, and unavailable snapshot references', async () => {
        const previous = { manifest: { version: 1, updatedAt: checkedAt, providers: {} } as const, providers: {} };
        serve({ ...previous.manifest, updatedAt: '2026-11-22T11:59:00.000Z' });
        await expect(loadDrivingFeed(previous, ['drivebc'], signal)).rejects.toThrow(/older/);
        serve({ ...previous.manifest, providers: { drivebc: { reports: disabled, cameras: disabled } } });
        await expect(loadDrivingFeed(previous, ['drivebc'], signal)).rejects.toThrow(/older/);
        serve({ ...previous.manifest, providers: { drivebc: { reports: { status: 'available' }, cameras: disabled } } });
        await expect(loadDrivingFeed(previous, ['drivebc'], signal)).rejects.toThrow(/snapshot file/);
        serve({ ...previous.manifest, providers: { drivebc: { reports: snapshot('cameras', []).ref, cameras: disabled } } });
        await expect(loadDrivingFeed(previous, ['drivebc'], signal)).rejects.toThrow();
        expect(fetcher).toHaveBeenCalledTimes(4);
    });

    it('propagates cancellation during a snapshot request', async () => {
        const controller = new AbortController();
        const snapshotFile = snapshot('reports', []);
        fetcher.mockImplementationOnce(async () => Response.json({ version: 1, updatedAt: checkedAt, providers: {
            drivebc: { reports: snapshotFile.ref, cameras: disabled },
        } }));
        fetcher.mockImplementationOnce(async () => {
            controller.abort();
            return new Response(snapshotFile.body);
        });
        await expect(loadDrivingFeed(emptyFeed, ['drivebc'], controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    });
});
