import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
