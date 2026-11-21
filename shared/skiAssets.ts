export const skiAssetsRoute = '/data/ski-status/assets/';

export function isSkiAssetPathSegment(part: string) {
    return Boolean(part && !part.startsWith('.') && !part.endsWith('.') && part.trimEnd() === part
        && !/[/\\:<>"|?*\p{Cc}]/u.test(part));
}

export function skiAssetUrl(file: string) {
    return skiAssetsRoute + file.split('/').map(encodeURIComponent).join('/');
}

export function skiTerrainFile(checksum: string) {
    return `runtime/terrain/${checksum}/resort-terrain.pmtiles`;
}

export function skiRuntimeIconFile(file: string, checksum: string) {
    const [directory, name] = file.split('/');
    return `runtime/${directory}/${checksum}/${name}`;
}
