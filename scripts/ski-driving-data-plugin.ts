import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';
import { readDrivingCatalog } from '../shared/skiDrivingCatalog.ts';

const files = ['data/driving-corridors.json', 'research/road-approaches.json', 'data/areas.json']
    .map(path => normalizePath(fileURLToPath(new URL(`../projects/ski-status/${path}`, import.meta.url))));
const id = 'virtual:ski-driving-data';
const resolved = `\0${id}`;

export function skiDrivingDataPlugin(): Plugin {
    return {
        name: 'ski-status-driving-data',
        resolveId(source) { if (source === id) return resolved; },
        async load(source) {
            if (source !== resolved) return;
            const [corridors, roads, areas] = await Promise.all(files.map(async file => {
                this.addWatchFile(file);
                return JSON.parse(await readFile(file, 'utf8'));
            }));
            return `export default ${JSON.stringify(readDrivingCatalog(corridors, roads, areas))};`;
        },
        hotUpdate({ file, modules }) {
            if (!files.includes(normalizePath(file))) return;
            const module = this.environment.moduleGraph.getModuleById(resolved);
            if (module && !modules.includes(module)) return [...modules, module];
        },
    };
}
