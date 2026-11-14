// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import manifest from '../../tests/fixtures/trip-content/trips/coastal-test.json';

const roots: string[] = [];
const command = fileURLToPath(new URL('../update-trip-manifest-assets.js', import.meta.url));
afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmb-manifest-cli-'));
    roots.push(root);
    const directory = path.join(root, 'src/content/trips');
    const source = path.join(root, 'prepared');
    fs.mkdirSync(directory, { recursive: true });
    fs.mkdirSync(source);
    const filename = path.join(directory, `${manifest.id}.json`);
    const original = `${JSON.stringify(manifest, null, 2)}\n`;
    fs.writeFileSync(filename, original);
    const report = { tripId: manifest.id, photoPipelineVersion: 4, photos: manifest.photos.map(photo => ({
        id: photo.id, derivatives: [{ filename: `${photo.id}-012345abcdef-1600.webp`, width: 1600, height: 1000 }],
        full: { filename: `${photo.id}-012345abcdef-full.jpg`, width: 6000, height: 3750, derivatives: [] },
    })) };
    return { root, source, filename, original, report,
        run(extra: string[] = []) {
            fs.writeFileSync(path.join(source, 'asset-metadata.json'), JSON.stringify(report));
            return spawnSync(process.execPath, [command, manifest.id, '--source', source, ...extra], { cwd: root, encoding: 'utf8' });
        } };
}

describe('manifest update command', () => {
    it('writes validated photo assets while preserving authored metadata and gallery order', () => {
        const f = fixture();
        const result = f.run();
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain(`Updated ${manifest.photos.length} photo URLs`);
        const updated = JSON.parse(fs.readFileSync(f.filename, 'utf8'));
        expect(updated.galleries).toEqual(manifest.galleries);
        expect(updated.dates).toEqual(manifest.dates);
        expect(updated.hero).toBe(manifest.hero);
        expect(updated.photos[0].full.src).toContain('012345abcdef-full.jpg');
    });

    it('retains the exact existing manifest when report validation fails', () => {
        const f = fixture();
        f.report.photos[0].full.height = 6000;
        const result = f.run();
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('Invalid prepared full-resolution photo');
        expect(fs.readFileSync(f.filename, 'utf8')).toBe(f.original);
    });

    it('rejects extra options instead of silently writing during an apparent dry run', () => {
        const f = fixture();
        const result = f.run(['--dry-run']);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('Usage:');
        expect(fs.readFileSync(f.filename, 'utf8')).toBe(f.original);
    });
});
