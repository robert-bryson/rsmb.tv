import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
    it('allows trip images and route requests from the data CDN', () => {
        const config = readRepoFile('customHttp.yml');
        const connectSources = config.match(/connect-src ([^;]+)/)?.[1];

        expect(config).toContain("img-src 'self' data: blob: https://data.rsmb.tv");
        expect(config).toContain("script-src 'self' 'unsafe-eval' https://cloud.umami.is");
        expect(connectSources).toContain('https://cloud.umami.is');
        expect(connectSources).toContain('https://data.rcc-acis.org');
        expect(connectSources).toContain('https://data.rsmb.tv');
    });
});
