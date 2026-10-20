// @vitest-environment node
import { createPublicKey } from 'node:crypto';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function dkimValue(): string {
    const config = fs.readFileSync(new URL('../../infra/mail.tf', import.meta.url), 'utf8');
    const record = config.match(/resource "aws_route53_record" "mail_dkim" \{([\s\S]*?)\n\}/)?.[1];
    const literal = record?.match(/records\s*=\s*\[\s*("(?:\\.|[^"\\])*")\s*\]/)?.[1];
    if (!literal) throw new Error('Expected one literal TXT value in mail_dkim.records.');
    const value: unknown = JSON.parse(literal);
    if (typeof value !== 'string') throw new Error('Expected a string DKIM record.');
    return value;
}

describe('mail DKIM public key', () => {
    it('splits one TXT value into nonempty strings within the DNS byte limit', () => {
        const parts = dkimValue().split('""');
        expect(parts.length).toBeGreaterThan(1);
        for (const part of parts) {
            expect(Buffer.byteLength(part, 'utf8')).toBeGreaterThan(0);
            expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(255);
        }
    });

    it('publishes a complete 2048-bit RSA public key without extra DER data', () => {
        const value = dkimValue().replaceAll('""', '');
        const encodedKey = value.match(/^v=DKIM1; k=rsa; p=([A-Za-z0-9+/]+={0,2})$/)?.[1];
        if (!encodedKey) throw new Error('Expected a DKIM RSA public key.');
        const der = Buffer.from(encodedKey, 'base64');
        const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
        expect(key.asymmetricKeyType).toBe('rsa');
        expect(key.asymmetricKeyDetails?.modulusLength).toBe(2048);
        expect(key.export({ format: 'der', type: 'spki' })).toEqual(der);
    });
});
