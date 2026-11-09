// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflow = parse(fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const steps = workflow.jobs.release.steps;
const checkout = steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/checkout@'));
const push = steps.find((step: { name?: string }) => step.name === 'Point preview branch at the candidate revision').run;

describe('release checkout history', () => {
    function fixture(divergent = false) {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmb-release-checkout-'));
        const source = path.join(directory, 'source');
        const remote = path.join(directory, 'origin.git');
        const runner = path.join(directory, 'runner');
        const git = (cwd: string, ...args: string[]) => execFileSync('git', [
            '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
            ...(cwd === remote ? ['--git-dir', remote] : ['-C', cwd]), ...args,
        ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
        fs.mkdirSync(source);
        git(directory, 'init', '--bare', remote);
        git(source, 'init', '--initial-branch=main');
        git(source, 'config', 'user.name', 'Release fixture');
        git(source, 'config', 'user.email', 'release@example.invalid');
        git(source, 'remote', 'add', 'origin', pathToFileURL(remote).href);
        fs.writeFileSync(path.join(source, 'application.txt'), 'previous release\n');
        git(source, 'add', 'application.txt'); git(source, 'commit', '-m', 'Previous release');
        git(source, 'push', 'origin', 'HEAD:refs/heads/main', 'HEAD:refs/heads/release-preview');
        fs.writeFileSync(path.join(source, 'application.txt'), 'candidate release\n');
        git(source, 'commit', '-am', 'Candidate release'); git(source, 'push', 'origin', 'main');
        if (divergent) {
            git(source, 'checkout', '-b', 'competing', 'origin/release-preview');
            fs.writeFileSync(path.join(source, 'preview-only.txt'), 'competing preview\n');
            git(source, 'add', 'preview-only.txt'); git(source, 'commit', '-m', 'Competing preview');
            git(source, 'push', 'origin', 'HEAD:refs/heads/release-preview');
        }
        const depth = Number(checkout.with?.['fetch-depth'] ?? 1);
        git(directory, 'clone', '--branch', 'main', ...(depth ? ['--depth', String(depth)] : []), pathToFileURL(remote).href, runner);
        return { directory, remote, runner, git };
    }
    it('can advance an existing preview to the candidate with the configured checkout', () => {
        const { directory, remote, runner, git } = fixture();
        try {
            execFileSync('bash', ['-e', '-c', push], { cwd: runner, stdio: ['ignore', 'pipe', 'pipe'] });
            expect(git(remote, 'rev-parse', 'refs/heads/release-preview')).toBe(git(remote, 'rev-parse', 'refs/heads/main'));
        } finally { fs.rmSync(directory, { recursive: true, force: true }); }
    });
    it('preserves a competing preview branch instead of forcing its replacement', () => {
        const { directory, remote, runner, git } = fixture(true);
        try {
            const previous = git(remote, 'rev-parse', 'refs/heads/release-preview');
            expect(() => execFileSync('bash', ['-e', '-c', push], { cwd: runner, stdio: ['ignore', 'pipe', 'pipe'] })).toThrow();
            expect(git(remote, 'rev-parse', 'refs/heads/release-preview')).toBe(previous);
        } finally { fs.rmSync(directory, { recursive: true, force: true }); }
    });
});
