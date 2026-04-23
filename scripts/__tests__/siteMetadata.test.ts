import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    formatIsoDate,
    formatRssDate,
    resolveLatestTimestamp,
    sortByDateDescending,
} from '../siteMetadata.js';

const tempDirs: string[] = [];

function createTempDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmbtv-site-metadata-'));
    tempDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('resolveLatestTimestamp', () => {
    it('prefers git history when available', () => {
        const execFileSyncImpl = vi.fn().mockReturnValue('1712793600\n');

        const timestamp = resolveLatestTimestamp(['src/content/posts.json'], {
            repoRoot: '/repo',
            execFileSyncImpl,
        });

        expect(timestamp).toBe(1712793600 * 1000);
        expect(execFileSyncImpl).toHaveBeenCalledWith(
            'git',
            ['log', '-1', '--format=%ct', '--', 'src/content/posts.json'],
            { cwd: '/repo', encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
        );
    });

    it('falls back to the newest file mtime across nested directories', () => {
        const repoRoot = createTempDir();
        const nestedDir = path.join(repoRoot, 'src/content/blog');
        const olderFile = path.join(nestedDir, 'older.mdx');
        const newerFile = path.join(nestedDir, 'newer.mdx');
        const olderTime = new Date('2026-04-08T12:00:00Z');
        const newerTime = new Date('2026-04-19T15:30:00Z');

        fs.mkdirSync(nestedDir, { recursive: true });
        fs.writeFileSync(olderFile, 'older');
        fs.writeFileSync(newerFile, 'newer');
        fs.utimesSync(olderFile, olderTime, olderTime);
        fs.utimesSync(newerFile, newerTime, newerTime);

        const timestamp = resolveLatestTimestamp(['src/content/blog'], {
            repoRoot,
            execFileSyncImpl: vi.fn().mockImplementation(() => {
                throw new Error('git unavailable');
            }),
        });

        expect(timestamp).toBeDefined();
        expect(formatIsoDate(timestamp!)).toBe('2026-04-19');
        expect(timestamp).toBeGreaterThan(olderTime.getTime());
    });

    it('returns undefined when no source files exist', () => {
        const repoRoot = createTempDir();

        const timestamp = resolveLatestTimestamp(['missing/path.ts'], {
            repoRoot,
            execFileSyncImpl: vi.fn().mockImplementation(() => {
                throw new Error('git unavailable');
            }),
        });

        expect(timestamp).toBeUndefined();
    });
});

describe('date helpers', () => {
    it('formats timestamps consistently for rss and sitemap output', () => {
        const timestamp = Date.UTC(2026, 3, 8, 21, 55, 30);

        expect(formatRssDate(timestamp)).toBe('Wed, 08 Apr 2026 21:55:30 GMT');
        expect(formatIsoDate(timestamp)).toBe('2026-04-08');
    });

    it('sorts posts newest-first without mutating the input array', () => {
        const posts = [
            { slug: 'older', date: '2026-04-08' },
            { slug: 'newer', date: '2026-04-19' },
        ];

        const sorted = sortByDateDescending(posts);

        expect(sorted.map((post) => post.slug)).toEqual(['newer', 'older']);
        expect(posts.map((post) => post.slug)).toEqual(['older', 'newer']);
    });
});
