import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

export async function copyTripAsset(source, destination) {
    try {
        await fs.copyFile(source, destination);
    } catch (error) {
        // Drive-backed WSL mounts can reject the native copy operation even
        // when ordinary reads and writes work. Real I/O errors still propagate.
        if (!['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EXDEV'].includes(error?.code)) throw error;
        const temporary = `${destination}.${randomUUID()}.tmp`;
        try {
            await pipeline(createReadStream(source), createWriteStream(temporary, { flags: 'wx' }));
            await fs.rename(temporary, destination);
        } finally {
            await fs.rm(temporary, { force: true });
        }
    }
}
