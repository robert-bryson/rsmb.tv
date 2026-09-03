import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PRIVATE_RIDE_LEDGER_PATHS = [
    'projects/ride-ledger/data/',
    'projects/ride-ledger/exports/',
    'projects/ride-ledger/receipts/',
];

describe('Ride Ledger repository privacy policy', () => {
    it('ignores directories that can contain personal records', async () => {
        const gitignore = await readFile(path.join(process.cwd(), '.gitignore'), 'utf8');
        const rules = new Set(
            gitignore
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line !== '' && !line.startsWith('#')),
        );

        for (const privatePath of PRIVATE_RIDE_LEDGER_PATHS) {
            expect(rules, `Missing .gitignore rule for ${privatePath}`).toContain(privatePath);
        }
    });

    it('documents the private directories and fixture restrictions', async () => {
        const readme = await readFile(path.join(process.cwd(), 'README.md'), 'utf8');

        for (const privatePath of PRIVATE_RIDE_LEDGER_PATHS) {
            expect(readme).toContain(`\`${privatePath}\``);
        }

        expect(readme).toContain('only synthetic, de-identified fixtures');
        expect(readme).toContain('Do not copy rows from the source spreadsheet into a fixture.');
    });
});