#!/usr/bin/env node

/**
 * Runs the Google blog sync before local development when it is configured.
 *
 * Vite loads .env files for the browser process, but this Node pre-step needs
 * the same local GOOGLE_BLOG_* values before Vite starts.
 */

import { loadLocalEnvFiles, syncBlogPosts } from './sync-blogs.js';

loadLocalEnvFiles();

if (/^(0|false|no|off)$/i.test(String(process.env.GOOGLE_BLOG_SYNC_ON_DEV ?? ''))) {
    console.log('Skipping blog sync before dev because GOOGLE_BLOG_SYNC_ON_DEV is disabled.');
    process.exit(0);
}

if (!process.env.GOOGLE_BLOG_SHEET_ID) {
    console.log('Skipping blog sync before dev because GOOGLE_BLOG_SHEET_ID is not configured.');
    process.exit(0);
}

try {
    const result = await syncBlogPosts();
    const changed = result.changed ? `updated ${result.changedFileLabels.length} file(s)` : 'no file changes';
    console.log(`Synced ${result.syncedPosts} blog post(s) before dev: ${changed}.`);
} catch (error) {
    console.error(`Blog sync before dev failed: ${error.message}`);
    process.exit(1);
}
