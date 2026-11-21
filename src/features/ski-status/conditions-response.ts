export const maxConditionsManifestBytes = 64 * 1024;
export const maxConditionsSnapshotBytes = 8 * 1024 * 1024;

export function decodeConditionsText(bytes: Uint8Array) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function decodeConditionsJson(bytes: Uint8Array): unknown {
    return JSON.parse(decodeConditionsText(bytes));
}

export async function readConditionsBytes(response: Response, limit: number, label: string) {
    if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw Error(`${label} returned HTTP ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw Error(`${label} response is empty`);

    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) {
                void reader.cancel().catch(() => {});
                throw Error(`${label} response exceeds the size limit`);
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
