export { readResponseBytes as readConditionsBytes } from '../../../shared/readResponseBytes.ts';

export const maxConditionsManifestBytes = 64 * 1024;
export const maxConditionsSnapshotBytes = 8 * 1024 * 1024;

export function decodeConditionsText(bytes: Uint8Array) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function decodeConditionsJson(bytes: Uint8Array): unknown {
    return JSON.parse(decodeConditionsText(bytes));
}
