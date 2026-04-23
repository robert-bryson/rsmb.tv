import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function collectFiles(entryPath, fsImpl, pathImpl) {
    let stats;

    try {
        stats = fsImpl.statSync(entryPath);
    } catch {
        return [];
    }

    if (stats.isFile()) {
        return [entryPath];
    }

    if (!stats.isDirectory()) {
        return [];
    }

    return fsImpl
        .readdirSync(entryPath, { withFileTypes: true })
        .flatMap((entry) => collectFiles(pathImpl.join(entryPath, entry.name), fsImpl, pathImpl));
}

export function loadJsonFile(filePath, { fsImpl = fs } = {}) {
    return JSON.parse(fsImpl.readFileSync(filePath, 'utf-8'));
}

export function sortByDateDescending(items) {
    return [...items].sort(
        (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
    );
}

export function resolveLatestTimestamp(paths, {
    repoRoot = process.cwd(),
    fsImpl = fs,
    pathImpl = path,
    execFileSyncImpl = execFileSync,
} = {}) {
    const uniquePaths = [...new Set(paths)];

    if (uniquePaths.length === 0) {
        return undefined;
    }

    try {
        const gitTimestamp = execFileSyncImpl(
            'git',
            ['log', '-1', '--format=%ct', '--', ...uniquePaths],
            { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
        ).trim();
        const timestampMs = Number(gitTimestamp) * 1000;

        if (Number.isFinite(timestampMs) && timestampMs > 0) {
            return timestampMs;
        }
    } catch {
        // Fall back to filesystem metadata outside a git checkout.
    }

    let latestTimestamp;

    for (const sourcePath of uniquePaths) {
        const absolutePath = pathImpl.join(repoRoot, sourcePath);

        for (const filePath of collectFiles(absolutePath, fsImpl, pathImpl)) {
            const stats = fsImpl.statSync(filePath);

            if (!stats.isFile()) {
                continue;
            }

            if (latestTimestamp === undefined || stats.mtimeMs > latestTimestamp) {
                latestTimestamp = stats.mtimeMs;
            }
        }
    }

    return latestTimestamp;
}

export function formatRssDate(timestamp) {
    return new Date(timestamp).toUTCString();
}

export function formatIsoDate(timestamp) {
    return new Date(timestamp).toISOString().split('T')[0];
}
