import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const terraform = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../infra/main.tf'), 'utf8');
const source = terraform.match(/code\s*=\s*<<-JS\n([\s\S]*?)\n\s*JS/)?.[1];
if (!source) throw new Error('CloudFront redirect function is missing');

function redirect(uri: string, querystring: Record<string, { value: string; multiValue?: Array<{ value: string }> }> = {}) {
    return runInNewContext(`${source}\nhandler(event)`, { event: { request: { uri, querystring } } });
}

describe('CloudFront apex redirect', () => {
    it('redirects paths to the canonical host with permanent caching', () => {
        expect(redirect('/projects/flights/map')).toEqual({
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: { value: 'https://www.rsmb.tv/projects/flights/map' },
                'cache-control': { value: 'max-age=86400' },
            },
        });
    });

    it('preserves repeated filters, encoded values, and empty query parameters', () => {
        const response = redirect('/projects/flights/map', {
            region: { value: 'US-WA', multiValue: [{ value: 'US-WA' }, { value: 'US-OR' }] },
            label: { value: 'A%26B%20%2B%20C' },
            empty: { value: '' },
        });
        const url = new URL(response.headers.location.value);
        expect(url.searchParams.getAll('region')).toEqual(['US-WA', 'US-OR']);
        expect(url.searchParams.get('label')).toBe('A&B + C');
        expect(url.searchParams.get('empty')).toBe('');
    });
});
