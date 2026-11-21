export async function readResponseBytes(response: Response, limit: number, label: string) {
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
