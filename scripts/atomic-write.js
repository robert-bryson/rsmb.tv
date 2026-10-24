import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export async function writeAtomically(filename, data) {
    const temporary = `${filename}.${randomUUID()}.tmp`;
    try {
        await fs.writeFile(temporary, data, { flag: 'wx' });
        await fs.rename(temporary, filename);
    } finally {
        await fs.rm(temporary, { force: true });
    }
}
