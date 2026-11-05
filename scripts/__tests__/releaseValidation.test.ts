// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { assertAssetType, assertDeploymentIdentity, assertReleaseData, assertTornadoGeometry } from '../validate-release-preview.js';
import { makeFlight, makeAirport } from '../../src/test/helpers/flights';
import { verifyPreviewRevision } from '../verify-preview-revision.js';
import { releaseAmplify, waitForBuild } from '../release-amplify.js';
import { validateReleasePreview } from '../validate-release-preview.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const revision = 'a'.repeat(40);

describe('hosted release validation', () => {
    function publishedData() {
        return new Map<string, unknown>([
            ['recentRecords.json', { asOf: '2026-11-05', yesterday: [], last7Days: [], monthlyThresholdVersion: 2 }],
            ['stateRecords.json', { type: 'FeatureCollection', features: [] }],
            ['countyRecords.json', { type: 'FeatureCollection', features: [] }],
            ['flights.geojson', { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[-122.31, 47.45], [-118.41, 33.94]] }, properties: makeFlight() }] }],
            ['visitedAirports.geojson', { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-122.31, 47.45] }, properties: makeAirport('SEA') }] }],
            ['annual-summary.json', [{ year: 2025, count: 1, unknown: 0, ef0: 0, ef1: 0, ef2: 1, ef3: 0, ef4: 0, ef5: 0, ef1Plus: 1, ef2Plus: 1, deaths: 0, injuries: 0, trackMiles: 1, medianWidthYards: 100 }]],
            ['trend-index.json', { version: 1, groups: [{ year: 2025, state: 'MO', scale: 2, count: 1, deaths: 0, injuries: 0, trackMiles: 1, widths: [[100, 1]] }] }],
        ]);
    }
    it('blocks stale temperature thresholds and incompatible tornado data', () => {
        const data = publishedData();
        expect(() => assertReleaseData(data)).not.toThrow();
        data.set('recentRecords.json', { asOf: '2026-11-05', yesterday: [], last7Days: [], monthlyThresholdVersion: 1 });
        expect(() => assertReleaseData(data)).toThrow('regeneration');
        data.set('recentRecords.json', publishedData().get('recentRecords.json'));
        data.set('trend-index.json', { version: 1, groups: [] });
        expect(() => assertReleaseData(data)).toThrow();
    });
    it.each(['flights.geojson', 'visitedAirports.geojson'])('rejects malformed records in %s', filename => {
        const data = publishedData();
        data.set(filename, { type: 'FeatureCollection', features: [{}] });
        expect(() => assertReleaseData(data)).toThrow();
        data.delete(filename);
        expect(() => assertReleaseData(data)).toThrow(`did not load ${filename}`);
    });
    it('checks coordinates and calendar dates in flight records', () => {
        const data = publishedData();
        data.set('flights.geojson', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: makeFlight({ date: '2/30/2024' }), geometry: { type: 'LineString', coordinates: [[200, 91], [0, 0]] } }] });
        expect(() => assertReleaseData(data)).toThrow();
    });
    it('checks geometry and shard year for tornado source responses', () => {
        const feature = { type: 'Feature', properties: { id: 'track', year: 2025 }, geometry: { type: 'LineString', coordinates: [[-90, 35], [-91, 36]] } };
        const collection = { type: 'FeatureCollection', features: [feature] };
        expect(() => assertTornadoGeometry(collection, '/tornadoes/tracks/2025.geojson')).not.toThrow();
        expect(() => assertTornadoGeometry(collection, '/tornadoes/tracks/2024.geojson')).toThrow('geometry');
        expect(() => assertTornadoGeometry(collection, '/tornadoes/track-points/2025.geojson')).toThrow('geometry');
        expect(() => assertTornadoGeometry({ ...collection, features: [{ ...feature, geometry: { type: 'Point', coordinates: [-90, 35] } }] }, '/tornadoes/track-points/2025.geojson')).not.toThrow();
        expect(() => assertTornadoGeometry({ ...collection, features: [{ ...feature, geometry: { type: 'LineString', coordinates: [[-190, 35], [-91, 36]] } }] }, '/tornadoes/tracks/2025.geojson')).toThrow('geometry');
        expect(() => assertTornadoGeometry({}, '/tornadoes/tracks/2025.geojson')).toThrow('geometry');
    });
    it.each(['chunk.js', 'styles.css', 'photo.avif', 'photo.webp', 'flights.geojson', 'recentRecords.json'])('rejects SPA HTML served for %s', file => {
        expect(() => assertAssetType(`https://preview.example/${file}`, 'text/html; charset=utf-8')).toThrow('Wrong MIME type');
    });
    it.each([['chunk.js', 'text/javascript'], ['photo.avif', 'image/avif'], ['flights.geojson', 'application/geo+json']])('accepts the asset type for %s', (file, type) => {
        expect(() => assertAssetType(`https://preview.example/${file}`, type)).not.toThrow();
    });
    it.each([['photo.avif', 'image/png'], ['photo.webp', 'image/jpeg'], ['font.woff2', 'text/plain']])('rejects a mismatched asset MIME type for %s', (file, type) => {
        expect(() => assertAssetType(`https://preview.example/${file}`, type)).toThrow('Wrong MIME type');
    });
    it('rejects a stale deployment and requires an Amplify job identity', () => {
        expect(() => assertDeploymentIdentity({ commitId: 'b'.repeat(40), jobId: '1' }, revision)).toThrow('does not match');
        expect(() => assertDeploymentIdentity({ commitId: revision }, revision)).toThrow('does not match');
        assertDeploymentIdentity({ commitId: revision, jobId: '1' }, revision);
        assertDeploymentIdentity({ commitId: revision, jobId: '0000000001' }, revision, '1');
        expect(() => assertDeploymentIdentity({ commitId: revision, jobId: '1' }, revision, '2')).toThrow('older build');
    });
    it('prevents a newer main commit from passing the production build guard', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ commitId: revision, jobId: '1' })));
        await expect(verifyPreviewRevision('https://preview.example', 'b'.repeat(40), fetchImpl)).rejects.toThrow('no matching deployed preview');
        expect(fetchImpl.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
    });
    it('blocks production when a matching deployed preview has no successful validation proof', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ commitId: revision, jobId: '1' })))
            .mockResolvedValueOnce(new Response('Not found', { status: 404 }));
        await expect(verifyPreviewRevision('https://preview.example', revision, fetchImpl)).rejects.toThrow(/validation/i);
    });
    it('never starts production after a preview fails validation', async () => {
        const calls: string[] = [];
        const client = { send: vi.fn(async command => {
            calls.push(command.input.branchName ?? 'app');
            return command.input.branchName ? { jobSummary: { jobId: '1' } } : { app: { defaultDomain: 'example.amplifyapp.com' } };
        }) };
        await expect(releaseAmplify({ client, appId: 'dexample', revision, wait: vi.fn(), validate: vi.fn().mockRejectedValue(new Error('Image failed to decode')) })).rejects.toThrow('Image failed to decode');
        expect(calls).toEqual(['app', 'release-preview']);
    });
    it('rejects a successful build for the wrong revision and bounds build polling', async () => {
        const client = { send: vi.fn().mockResolvedValue({ job: { summary: { commitId: 'b'.repeat(40), status: 'SUCCEED' } } }) };
        await expect(waitForBuild(client, 'app', 'release-preview', '1', revision)).rejects.toThrow('different revision');
        client.send.mockResolvedValue({ job: { summary: { commitId: revision, status: 'RUNNING' } } });
        const sleep = vi.fn();
        await expect(waitForBuild(client, 'app', 'release-preview', '1', revision, { attempts: 2, sleep })).rejects.toThrow('timed out');
        expect(sleep).toHaveBeenCalledTimes(2);
    });
    it('closes an allocated context if page creation fails and preserves the report', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'release-cleanup-test-'));
        const context = { newPage: vi.fn().mockRejectedValue(new Error('Browser page unavailable')), close: vi.fn() };
        const browser = { newContext: vi.fn().mockResolvedValue(context), close: vi.fn() };
        const outputPath = path.join(directory, 'nested/report.json');
        try {
            await expect(validateReleasePreview({ baseURL: 'https://preview.example', revision, browser, outputPath })).rejects.toThrow('Browser page unavailable');
            expect(context.close).toHaveBeenCalledOnce();
            expect(browser.close).not.toHaveBeenCalled();
            expect(JSON.parse(await fs.readFile(outputPath, 'utf8')).errors).toContain('Browser page unavailable');
        } finally { await fs.rm(directory, { recursive: true, force: true }); }
    });
    it('keeps the validation failure if report persistence also fails', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'release-cleanup-test-'));
        const context = { newPage: vi.fn().mockRejectedValue(new Error('Browser page unavailable')), close: vi.fn() };
        const browser = { newContext: vi.fn().mockResolvedValue(context) };
        try {
            await expect(validateReleasePreview({ baseURL: 'https://preview.example', revision, browser, outputPath: directory })).rejects.toThrow('Browser page unavailable');
            expect(context.close).toHaveBeenCalledOnce();
        } finally { await fs.rm(directory, { recursive: true, force: true }); }
    });
});
