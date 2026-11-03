// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('keeps the previous published files when a full sync loses California', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temperature-publication-'));
    const repo = fileURLToPath(new URL('../..', import.meta.url));
    try {
        for (const filename of ['scripts/sync-temperatures.js', 'scripts/atomic-write.js', 'shared/geography/usStates.ts']) {
            fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
            fs.copyFileSync(path.join(repo, filename), path.join(root, filename));
        }
        fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
        const output = path.join(root, 'public/data/temperatures');
        fs.mkdirSync(output, { recursive: true });
        for (const filename of ['stateRecords.json', 'countyRecords.json']) fs.writeFileSync(path.join(output, filename), 'previous complete snapshot');
        fs.writeFileSync(path.join(root, 'mock-acis.mjs'), `
            import { usStates } from './shared/geography/usStates.ts';
            globalThis.fetch = async (url, options) => {
                if (url.includes('scec')) return new Response(JSON.stringify({ records: usStates.flatMap(state =>
                    ['Maximum', 'Minimum'].map(kind => ({ state: state.name, element: 'All-Time ' + kind + ' Temperature', value: kind === 'Maximum' ? 100 : 0, begdate: '20000101' }))
                ) }));
                if (url.includes('MultiStnData')) {
                    const { state } = JSON.parse(options.body);
                    if (state === 'CA') return new Response(JSON.stringify({ error: 'California unavailable' }));
                    const metadata = usStates.find(item => item.abbr === state);
                    return new Response(JSON.stringify({ data: [{ meta: { name: 'Test', county: metadata.fips + '001', ll: [-100, 39] }, smry: [[100, '2000-07-01'], [0, '2000-01-01']] }] }));
                }
                throw new Error('Unexpected request: ' + url);
            };
        `);
        const result = spawnSync(process.execPath, ['--import', './mock-acis.mjs', 'scripts/sync-temperatures.js'], {
            cwd: root, env: { ...process.env, TEMPERATURE_DATA_BUCKET: '', TEMP_DATA_DIR: path.join(root, 'cache') },
            encoding: 'utf8', timeout: 10_000,
        });
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('County records for CA: California unavailable');
        for (const filename of ['stateRecords.json', 'countyRecords.json']) {
            expect(fs.readFileSync(path.join(output, filename), 'utf8')).toBe('previous complete snapshot');
        }
        expect(fs.existsSync(path.join(output, 'summary.json'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'cache/cache/county-alltime/CA'))).toBe(false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}, 15_000);
