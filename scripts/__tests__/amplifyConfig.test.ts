import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readRepoFile(relativePath: string) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8');
}

function getPhaseCommands(config: string, phaseName: string) {
    const lines = config.split(/\r?\n/);
    const phaseIndex = lines.findIndex((line) => line.trim() === `${phaseName}:`);

    expect(phaseIndex).toBeGreaterThanOrEqual(0);

    const commandsIndex = lines.findIndex(
        (line, index) => index > phaseIndex && line.trim() === 'commands:'
    );

    expect(commandsIndex).toBeGreaterThan(phaseIndex);

    const commandsIndent = lines[commandsIndex].match(/^\s*/)?.[0].length ?? 0;
    const commands: string[] = [];

    for (const line of lines.slice(commandsIndex + 1)) {
        if (!line.trim()) continue;

        const indent = line.match(/^\s*/)?.[0].length ?? 0;
        if (indent <= commandsIndent) break;

        const command = line.trim().match(/^-\s+(.+)$/)?.[1];
        if (command) commands.push(command);
    }

    return commands;
}

describe('amplify.yml', () => {
    it('installs the checked-in Node version before installing dependencies', () => {
        const nodeVersion = readRepoFile('.nvmrc').trim();
        const preBuildCommands = getPhaseCommands(readRepoFile('amplify.yml'), 'preBuild');

        expect(nodeVersion).toMatch(/^24\.\d+\.\d+$/);
        expect(preBuildCommands).toEqual([
            'nvm install',
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
            /custom_rule \{[\s\S]*?source\s*=\s*"([^"]+)"[\s\S]*?target\s*=\s*"\/index\.html"/,
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
