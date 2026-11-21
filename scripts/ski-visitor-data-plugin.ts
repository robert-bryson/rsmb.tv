import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';
import { readResortAccess } from '../shared/skiResortAccess.ts';

const directory = fileURLToPath(new URL('../projects/ski-status/research', import.meta.url));
const catalogPath = fileURLToPath(new URL('../projects/ski-status/data/areas.json', import.meta.url));
const filenamePattern = /^resort-access-\d{4}(?:-\d{2})?\.json$/;
const moduleId = 'virtual:ski-visitor-data';
const resolvedId = `\0${moduleId}`;

export function skiVisitorDataPlugin(): Plugin {
    return {
        name: 'ski-status-visitor-data',
        resolveId(id) {
            if (id === moduleId) return resolvedId;
        },
        async load(id) {
            if (id !== resolvedId) return;
            this.addWatchFile(catalogPath);
            const [names, catalog] = await Promise.all([readdir(directory), readFile(catalogPath, 'utf8')]);
            const areas: { id: string }[] = JSON.parse(catalog);
            const files: unknown[] = await Promise.all(names.filter(name => filenamePattern.test(name)).sort().map(async name => {
                const file = resolve(directory, name);
                this.addWatchFile(file);
                return JSON.parse(await readFile(file, 'utf8'));
            }));
            return `export default ${JSON.stringify([...readResortAccess(files, areas)])};`;
        },
        hotUpdate({ file, modules }) {
            const isVisitorFile = normalizePath(dirname(file)) === normalizePath(directory) && filenamePattern.test(basename(file));
            if (!isVisitorFile && normalizePath(file) !== normalizePath(catalogPath)) return;
            const visitorModule = this.environment.moduleGraph.getModuleById(resolvedId);
            if (visitorModule && !modules.includes(visitorModule)) return [...modules, visitorModule];
        },
    };
}
