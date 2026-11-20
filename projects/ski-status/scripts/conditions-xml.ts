import { DOMParser } from '@xmldom/xmldom';

const maxXmlBytes = 256 * 1024;

export function conditionsXmlRoot(xml: string, provider: string) {
    if (/<!DOCTYPE/i.test(xml)) throw Error(`${provider} XML contains a document type`);
    return new DOMParser({ onError: (level, message) => { throw Error(`${level}: ${message}`); } })
        .parseFromString(xml, 'text/xml').documentElement;
}

export async function fetchConditionsXml(url: string, provider: string) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: 'application/xml' }, redirect: 'error' });
    if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw Error(`${provider} returned HTTP ${response.status}`);
    }
    if (!response.body) throw Error(`${provider} XML response is empty`);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let xml = '';
    for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > maxXmlBytes) throw Error(`${provider} XML response exceeds the size limit`);
        xml += decoder.decode(chunk, { stream: true });
    }
    return { xml: xml + decoder.decode(), retrievedAt: new Date().toISOString() };
}
