// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

it('builds the CI bundle from a clean checkout without generated blog content', () => {
    const workflow = parse(fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8'));
    const step = workflow.jobs.ci.steps.find((step: { run?: string }) => /\bvite build\b/.test(step.run ?? ''));
    expect(step).toBeDefined();
    expect(workflow.on).toHaveProperty('pull_request');
    expect(workflow.on).toHaveProperty('push');
    expect(workflow.jobs.ci.if).toBeUndefined();
    expect(step.if).toBeUndefined();
    for (const env of [workflow.env, workflow.jobs.ci.env, step.env]) {
        expect(Object.values(env ?? {}).join('\n')).not.toMatch(/\bsecrets\./);
    }

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmb-ci-build-test-'));
    const generatedContent = [path.join(repoRoot, 'src/content/posts.json'), path.join(repoRoot, 'src/content/blog')];
    try {
        for (const entry of ['index.html', 'package.json', 'vite.config.ts', 'src', 'shared', 'scripts', 'tests/fixtures/trip-content']) {
            fs.cpSync(path.join(repoRoot, entry), path.join(root, entry), {
                recursive: true,
                filter: source => !generatedContent.includes(source),
            });
        }
        fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'), 'junction');
        expect(fs.existsSync(path.join(root, 'src/content/posts.json'))).toBe(false);

        const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', step.run], {
            cwd: root,
            env: {
                ...process.env,
                NODE_ENV: 'production',
                CARTO_API_KEY: '',
                VITE_CARTO_API_KEY: '',
                GOOGLE_BLOG_SHEET_ID: '',
            },
            encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
        });
        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
        const tripHtml = fs.readFileSync(path.join(root, 'dist/trips/coastal-test.html'), 'utf8');
        const postHtml = fs.readFileSync(path.join(root, 'dist/blog/reading-test.html'), 'utf8');
        expect(tripHtml).toContain('<title>Coastal test trip — rsmb</title>');
        expect(tripHtml).toContain('rel="canonical" href="https://rsmb.tv/trips/coastal-test"');
        expect(postHtml).toContain('<title>Reading test — rsmb</title>');
        const htmlFiles = fs.readdirSync(path.join(root, 'dist'), { recursive: true }).filter(filename => filename.endsWith('.html'));
        for (const filename of htmlFiles) {
            expect(fs.readFileSync(path.join(root, 'dist', filename), 'utf8'), filename).not.toContain('noindex');
        }
        expect(fs.existsSync(path.join(root, 'dist/trips/unfinished-draft.html'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'dist/blog/unfinished-draft.html'))).toBe(false);
        const assets = path.join(root, 'dist/assets');
        const scripts = fs.readdirSync(assets).filter(filename => filename.endsWith('.js'));
        expect(scripts.length).toBeGreaterThan(0);
        const bundledCode = scripts.map(filename => fs.readFileSync(path.join(assets, filename), 'utf8')).join('\n');
        expect(bundledCode).toContain('Opening story paragraph.');
        expect(bundledCode).not.toContain('unfinished-draft');
        expect(bundledCode).not.toContain('Unfinished draft must stay private');
        expect(fs.existsSync(path.join(root, 'src/content/posts.json'))).toBe(false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}, 40_000);
