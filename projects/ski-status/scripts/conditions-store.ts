import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

export const manifestName = 'manifest.json';
export type StoredObject = { body: Buffer; etag?: string };
export type ConditionsStore = {
    read: (file: string) => Promise<StoredObject | undefined>;
    write: (file: string, body: Buffer) => Promise<void>;
    commit: (body: Buffer, previous?: StoredObject) => Promise<void>;
};

const exec = promisify(execFile);
const prefix = 'ski-status/';
const runAws = async (args: string[]) => (await exec('aws', ['--no-cli-pager', ...args])).stdout;

export async function withConditionsStore<T>(
    directory: string, bucket: string | undefined, publish: (store: ConditionsStore) => Promise<T>, aws = runAws,
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
                async read(file) {
                    if (bucket) {
                        if (file === manifestName && !await existsRemotely(bucket, file)) return;
                        const path = join(staging, `${file}.download`);
                        let metadata: string;
                        try {
                            metadata = await aws(['s3api', 'get-object', '--bucket', bucket,
                                '--key', `${prefix}${file}`, '--output', 'json', path]);
                        } catch (error) {
                            if (file !== manifestName && !await existsRemotely(bucket, file)) return;
                            throw error;
                        }
                        const { ETag: etag } = JSON.parse(metadata) as { ETag?: string };
                        if (file === manifestName && !etag) throw Error('S3 omitted the manifest ETag');
                        return { body: await readFile(path), etag };
                    }
                    try {
                        return { body: await readFile(join(directory, file)) };
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

    async function existsRemotely(bucket: string, file: string) {
        const key = `${prefix}${file}`;
        const result = await aws(['s3api', 'list-objects-v2', '--bucket', bucket, '--prefix', key, '--max-keys', '1', '--output', 'json']);
        const listed = JSON.parse(result) as { Contents?: { Key: string }[] };
        return listed.Contents?.some(object => object.Key === key) ?? false;
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
