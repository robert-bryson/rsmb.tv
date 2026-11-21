import { DOMParser } from '@xmldom/xmldom';
import { decodeConditionsText, readConditionsBytes } from '../../../src/features/ski-status/conditions-response.ts';

const maxXmlBytes = 256 * 1024;

export function conditionsXmlRoot(xml: string, provider: string) {
    if (/<!DOCTYPE/i.test(xml)) throw Error(`${provider} XML contains a document type`);
    return new DOMParser({ onError: (level, message) => { throw Error(`${level}: ${message}`); } })
        .parseFromString(xml, 'text/xml').documentElement;
}

export function conditionsXmlNumber(value: string | null | undefined, minimum = 0) {
    const clean = value?.trim();
    if (!clean || !/^-?\d+(?:\.\d+)?$/.test(clean)) return;
    const parsed = Number(clean);
    return Number.isFinite(parsed) && parsed >= minimum ? parsed : undefined;
}

export async function fetchConditionsXml(url: string, provider: string) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: 'application/xml' }, redirect: 'error' });
    const xml = decodeConditionsText(await readConditionsBytes(response, maxXmlBytes, provider));
    return { xml, retrievedAt: new Date().toISOString() };
}
