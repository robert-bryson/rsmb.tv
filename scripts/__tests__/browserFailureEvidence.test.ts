// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import smokeConfig from '../../playwright.config';
import tripConfig from '../../playwright.trip.config';

it.each([
    ['smoke', smokeConfig], ['trip', tripConfig],
])('retains traces and screenshots for an initial %s failure', (_suite, config) => {
    expect(config.use?.trace).toBe('retain-on-failure');
    expect(config.use?.screenshot).toBe('only-on-failure');
});

it('uploads both browser output directories after failure without granting write permissions', () => {
    const workflow = parse(fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'));
    const steps = workflow.jobs.ci.steps;
    const upload = steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(upload).toBeDefined();
    expect(upload.if).toBe('${{ failure() }}');
    expect(upload.uses).toMatch(/^actions\/upload-artifact@[a-f0-9]{40}$/);
    expect(upload.with.path.trim().split('\n')).toEqual([smokeConfig, tripConfig]
        .map(config => path.posix.normalize(`${config.outputDir ?? 'test-results'}/`)));
    expect(upload.with['retention-days']).toBe(7);
    expect(upload.with['if-no-files-found']).toBe('ignore');
    const tripBrowserIndex = steps.findIndex((step: { run?: string }) => step.run?.includes('test:trips:browser'));
    expect(tripBrowserIndex).toBeGreaterThanOrEqual(0);
    expect(steps.indexOf(upload)).toBeGreaterThan(tripBrowserIndex);
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs.ci.permissions ?? workflow.permissions).toEqual({ contents: 'read' });
});
