// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

function createSyncFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temperature-publication-'));
    const repo = fileURLToPath(new URL('../..', import.meta.url));
    for (const filename of ['scripts/sync-temperatures.js', 'scripts/atomic-write.js', 'shared/geography/usStates.ts']) {
        fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
        fs.copyFileSync(path.join(repo, filename), path.join(root, filename));
    }
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    const output = path.join(root, 'public/data/temperatures');
    fs.mkdirSync(output, { recursive: true });
    return { root, output };
}

it('keeps the previous published files when a full sync loses California', () => {
    const { root, output } = createSyncFixture();
    try {
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
            cwd: root, env: { ...process.env, TEMPERATURE_DATA_BUCKET: '', TEMP_DATA_DIR: path.join(root, 'cache'), GITHUB_OUTPUT: path.join(root, 'github-output') },
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

it.each([
    { phase: 'daily', persistent: false },
    { phase: 'daily', persistent: true },
    { phase: 'historical', persistent: true },
    { phase: 'monthly', persistent: true },
])('retries empty Delaware $phase responses in the recent-only CLI (persistent: $persistent)', ({ phase, persistent }) => {
    const { root, output } = createSyncFixture();
    const cache = path.join(root, 'cache');
    const previous = JSON.stringify({ dates: [], yesterday: [], last7Days: [] });
    fs.writeFileSync(path.join(output, 'recentRecords.json'), previous);
    try {
        fs.writeFileSync(path.join(root, 'mock-acis.mjs'), `
            import { usStates } from './shared/geography/usStates.ts';
            let delawareAttempts = 0;
            globalThis.fetch = async (url, options) => {
                if (options?.method !== 'POST') return new Response(JSON.stringify({ dates: [], last7Days: [], stations: [] }));
                const params = JSON.parse(options.body);
                const requestPhase = params.date ? 'daily' : params.elems[0].duration === 'mtd' ? 'monthly' : 'historical';
                if (params.state === 'DE' && requestPhase === '${phase}') {
                    delawareAttempts++;
                    console.log('Delaware ${phase} attempt ' + delawareAttempts);
                    if (${persistent} || delawareAttempts === 1) return new Response(JSON.stringify({ data: [] }));
                }
                const stateIndex = usStates.findIndex(state => state.abbr === params.state);
                const meta = { uid: stateIndex + 1, name: 'Test', ll: [-100, 39], state: params.state };
                const station = params.date ? { data: ['110', '-10'] }
                    : params.elems[0].duration === 'mtd' ? { smry: [['120', '2000-11-01'], ['-20', '2000-11-01']] }
                        : { smry: [['100', '2000-07-01'], ['0', '2000-01-01'], '70', '40'] };
                return new Response(JSON.stringify({ data: [{ meta, ...station }] }));
            };
        `);
        const result = spawnSync(process.execPath, ['--import', './mock-acis.mjs', 'scripts/sync-temperatures.js', '--recent-only', '--backfill-days=1'], {
            cwd: root, env: { ...process.env, TEMPERATURE_DATA_BUCKET: '', TEMP_DATA_DIR: cache, GITHUB_OUTPUT: path.join(root, 'github-output') },
            encoding: 'utf8', timeout: 10_000,
        });
        expect(result.error).toBeUndefined();
        expect(result.stdout.match(/Delaware \w+ attempt/g)).toHaveLength(persistent ? 3 : 2);
        if (persistent) {
            expect(result.status).toBe(1);
            expect(result.stderr).toMatch(/Recent records for DE on .*: (No station observations returned|ACIS returned no station data)/);
            expect(fs.readFileSync(path.join(output, 'recentRecords.json'), 'utf8')).toBe(previous);
            expect(fs.existsSync(path.join(cache, 'daily'))).toBe(false);
            expect(fs.existsSync(path.join(cache, 'stations.json'))).toBe(false);
            if (phase !== 'daily') {
                const category = phase === 'historical' ? 'hist-daily' : 'monthly-v2';
                expect(fs.existsSync(path.join(cache, 'cache', category, 'DE'))).toBe(false);
            }
        } else {
            expect(result.status, result.stderr).toBe(0);
            const recent = JSON.parse(fs.readFileSync(path.join(output, 'recentRecords.json'), 'utf8'));
            expect(recent.yesterday).toHaveLength(96);
            expect(recent.yesterday.filter((record: { state: string }) => record.state === 'DE')).toHaveLength(2);
            const [date] = recent.dates;
            expect(recent.coverageByDate[date].completedStates).toHaveLength(48);
            const archive = JSON.parse(fs.readFileSync(path.join(cache, 'daily', date.slice(0, 4), date.slice(5, 7), date + '.json'), 'utf8'));
            expect(archive.observations).toHaveLength(48);
            expect(archive.coverage).toEqual(recent.coverageByDate[date]);
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}, 15_000);
