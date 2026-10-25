import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { parse } from 'yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const npmInstallCommand = `npm install --global "$(node -p "require('./package.json').packageManager")"`;

function readRepoFile(relativePath: string) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8');
}

function getPhaseCommands(config: string, phaseName: string) {
    const parsed = parse(config) as {
        frontend: { phases: Record<string, { commands: string[] }> };
    };
    return parsed.frontend.phases[phaseName].commands;
}

describe('amplify.yml', () => {
    it('installs the checked-in Node version before installing dependencies', () => {
        const nodeVersion = readRepoFile('.nvmrc').trim();
        const preBuildCommands = getPhaseCommands(readRepoFile('amplify.yml'), 'preBuild');

        expect(nodeVersion).toMatch(/^24\.\d+\.\d+$/);
        expect(preBuildCommands).toEqual([
            'nvm install',
            npmInstallCommand,
            'npm ci --cache .npm --prefer-offline',
        ]);
        expect(preBuildCommands).not.toContain('nvm use');
    });

    it('builds the committed Vite output directory and caches only npm artifacts', () => {
        const config = readRepoFile('amplify.yml');

        expect(config).toContain('baseDirectory: dist');
        expect(config).toContain('- npm run build');
        expect(config).toContain('- .npm/**/*');
    });
});

describe('dependency installation contracts', () => {
    it('runs type checking with the compiler required by the lint adapter', () => {
        const help = execFileSync('npm', ['run', 'typecheck', '--', '--help'], { cwd: repoRoot, encoding: 'utf8' });
        expect(help).toContain(`Version ${ts.version}`);
    });

    it.each([
        ['sync-temperatures.yml', 'AWS_TEMPERATURE_SYNC_ROLE_ARN'],
        ['sync-tornadoes.yml', 'AWS_TORNADO_SYNC_ROLE_ARN'],
    ])('switches %s to OIDC only after its role is configured', (filename, variable) => {
        const workflow = parse(readRepoFile(`.github/workflows/${filename}`));
        expect(workflow.permissions['id-token']).toBe('write');
        const steps = workflow.jobs.sync.steps;
        const oidc = steps.find((step: { name: string }) => step.name === 'Configure AWS with OIDC');
        const legacy = steps.find((step: { name: string }) => step.name === 'Configure AWS with existing keys during migration');
        expect(oidc.if).toBe(`vars.${variable} != ''`);
        expect(legacy.if).toBe(`vars.${variable} == ''`);
        expect(oidc.uses).toMatch(/^aws-actions\/configure-aws-credentials@[a-f0-9]{40}$/);
        expect(oidc.with['role-to-assume']).toBe(`\${{ vars.${variable} }}`);
        expect(oidc.with['role-duration-seconds']).toBe(3600);
        expect(oidc.with).not.toHaveProperty('aws-secret-access-key');
        expect(legacy.with['aws-secret-access-key']).toBe('${{ secrets.AWS_SECRET_ACCESS_KEY }}');
        for (const step of steps) expect(step.env ?? {}).not.toHaveProperty('AWS_SECRET_ACCESS_KEY');
    });

    it('uses the configured npm version before npm ci in every workflow job', () => {
        const workflowFiles = fs.readdirSync(path.join(repoRoot, '.github/workflows'))
            .filter((filename) => /\.ya?ml$/.test(filename));
        let checkedJobs = 0;
        for (const filename of workflowFiles) {
            const workflow = parse(readRepoFile(`.github/workflows/${filename}`)) as {
                jobs: Record<string, { steps?: Array<{ run?: string }> }>;
            };
            for (const [jobName, job] of Object.entries(workflow.jobs)) {
                const commands = (job.steps ?? []).flatMap((step) => step.run ? [step.run] : []);
                const dependencyIndex = commands.findIndex((command) => /\bnpm ci\b/.test(command));
                if (dependencyIndex < 0) continue;
                const npmIndex = commands.indexOf(npmInstallCommand);
                expect(npmIndex, `${filename}: ${jobName}`).toBeGreaterThanOrEqual(0);
                expect(npmIndex, `${filename}: ${jobName}`).toBeLessThan(dependencyIndex);
                checkedJobs += 1;
            }
        }
        expect(checkedJobs).toBeGreaterThan(0);
    });

    it('keeps paired dependencies aligned and does not override the router major', () => {
        const manifest = JSON.parse(readRepoFile('package.json'));
        expect(manifest.dependencies.react).toBe(manifest.dependencies['react-dom']);
        expect(manifest.devDependencies.vitest).toBe(manifest.devDependencies['@vitest/coverage-v8']);
        expect(manifest.overrides).not.toHaveProperty('react-router');
        expect(manifest.devDependencies.typescript).toMatch(/^npm:@typescript\/typescript6@/);
    });

    it('declares the supported Node lines and the npm major used by automated builds', () => {
        const manifest = JSON.parse(readRepoFile('package.json'));
        expect(manifest.packageManager).toMatch(/^npm@12\.\d+\.\d+$/);
        expect(manifest.engines.npm).toBe('>=12.2 <13');
        expect(manifest.engines.node).toBe('^22.22.2 || ^24.15.0 || ^26.0.0');
    });
});

describe('Amplify response headers', () => {
    it('allows the configured analytics, data, and map providers', () => {
        const config = parse(readRepoFile('customHttp.yml')) as {
            customHeaders: Array<{
                pattern: string;
                headers: Array<{ key: string; value: string }>;
            }>;
        };
        const wildcardHeaders = config.customHeaders.find(({ pattern }) => pattern === '**')?.headers;
        const policy = wildcardHeaders?.find(({ key }) => key === 'Content-Security-Policy')?.value;
        const imageSources = policy?.match(/img-src ([^;]+)/)?.[1];
        const connectSources = policy?.match(/connect-src ([^;]+)/)?.[1];

        expect(policy).toContain("script-src 'self' 'unsafe-eval' https://cloud.umami.is");
        expect(imageSources).toContain('https://data.rsmb.tv');
        expect(imageSources).toContain('https://tile.openstreetmap.org');
        expect(imageSources).toContain('https://tile.opentopomap.org');
        expect(connectSources).toContain('https://cloud.umami.is');
        expect(connectSources).toContain('https://gateway.umami.is');
        expect(connectSources).toContain('https://data.rcc-acis.org');
        expect(connectSources).toContain('https://data.rsmb.tv');
        expect(connectSources).toContain('https://demotiles.maplibre.org');
        expect(connectSources).toContain('https://tile.openstreetmap.org');
        expect(connectSources).toContain('https://tile.opentopomap.org');
    });
});

describe('Amplify domain', () => {
    it('serves JavaScript module assets without the SPA rewrite', () => {
        const config = readRepoFile('infra/main.tf');
        const spaRewrite = config.match(
            /custom_rule \{[^}]*?source\s*=\s*"([^"]+)"[^}]*?target\s*=\s*"\/index\.html"/,
        )?.[1];

        expect(spaRewrite).toBeDefined();
        expect(spaRewrite?.match(/\(css\|([^)]+)\)/)?.[1].split('|')).toContain('mjs');
    });

    it('uses an Amplify-managed certificate for the hosted domain', () => {
        const config = readRepoFile('infra/main.tf');
        const domainAssociation = config.match(
            /resource "aws_amplify_domain_association" "rsmbtv" \{([\s\S]*?)\n\}/,
        )?.[1];

        expect(domainAssociation).toBeDefined();
        expect(domainAssociation).toMatch(/certificate_settings\s*\{[\s\S]*?type\s*=\s*"AMPLIFY_MANAGED"/);
        expect(domainAssociation).not.toContain('custom_certificate_arn');
    });
});
