import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

export const manifestName = 'manifest.json';
export type StoredObject = { body: Buffer; etag?: string };
export type ConditionsStore = {
    // Include one extra byte so callers can detect a file that exceeds the limit.
    read: (file: string, limit: number) => Promise<StoredObject | undefined>;
    write: (file: string, body: Buffer) => Promise<void>;
    commit: (body: Buffer, previous?: StoredObject) => Promise<void>;
};

const exec = promisify(execFile);
const runAws = async (args: string[]) => (await exec('aws', ['--no-cli-pager', ...args])).stdout;

async function readBounded(path: string, limit: number) {
    const chunks: Buffer[] = [];
    for await (const chunk of createReadStream(path, { end: limit })) chunks.push(chunk);
    return Buffer.concat(chunks);
}

export async function withConditionsStore<T>(
    directory: string, bucket: string | undefined, publish: (store: ConditionsStore) => Promise<T>, aws = runAws,
    prefix = 'ski-status/',
) {
    await mkdir(directory, { recursive: true });
    const lock = join(directory, 'conditions.pid.lock');
    try {
        await writeFile(lock, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        throw Error(`A ski conditions publication is already running: ${lock}`, { cause: error });
    }

    try {
        const staging = await mkdtemp(join(directory, '.conditions-'));
        try {
            return await publish({
                async read(file, limit) {
                    if (bucket) {
                        if (file === manifestName && !await findRemoteObject(bucket, file)) return;
                        const path = join(staging, `${file}.download`);
                        let metadata: string;
                        try {
                            metadata = await aws(['s3api', 'get-object', '--bucket', bucket,
                                '--key', `${prefix}${file}`, '--range', `bytes=0-${limit}`, '--output', 'json', path]);
                        } catch (error) {
                            if (file !== manifestName) {
                                const listed = await findRemoteObject(bucket, file);
                                if (!listed || listed.Size === 0) return;
                            }
                            throw error;
                        }
                        const { ETag: etag } = JSON.parse(metadata) as { ETag?: string };
                        if (file === manifestName && !etag) throw Error('S3 omitted the manifest ETag');
                        return { body: await readBounded(path, limit), etag };
                    }
                    try {
                        return { body: await readBounded(join(directory, file), limit) };
                    } catch (error) {
                        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
                    }
                },
                write: (file, body) => write(staging, file, body, 86_400),
                commit(body, previous) {
                    if (bucket && previous && !previous.etag) throw Error('Cannot replace the S3 manifest without its ETag');
                    const condition = previous?.etag ? ['--if-match', previous.etag] : ['--if-none-match', '*'];
                    return write(staging, manifestName, body, 60, condition);
                },
            });
        } finally {
            await rm(staging, { recursive: true, force: true });
        }
    } finally {
        await rm(lock);
    }

    async function findRemoteObject(bucket: string, file: string) {
        const key = `${prefix}${file}`;
        const result = await aws(['s3api', 'list-objects-v2', '--bucket', bucket, '--prefix', key, '--max-keys', '1', '--output', 'json']);
        const listed = JSON.parse(result) as { Contents?: { Key: string; Size: number }[] };
        return listed.Contents?.find(object => object.Key === key);
    }

    async function write(staging: string, file: string, body: Buffer, ttl: number, condition: string[] = []) {
        const path = join(directory, file);
        const upload = join(staging, `${file}.upload`);
        await mkdir(dirname(path), { recursive: true });
        await mkdir(dirname(upload), { recursive: true });
        await writeFile(upload, body);
        if (bucket) await aws(['s3api', 'put-object', '--bucket', bucket, '--key', `${prefix}${file}`, '--body', upload,
            '--content-type', 'application/json', '--cache-control', `public, max-age=${ttl}`, ...condition]);
        await rename(upload, path);
    }
}
