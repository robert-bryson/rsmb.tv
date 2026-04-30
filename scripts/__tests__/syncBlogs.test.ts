// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildGoogleDocHtmlUrl,
    buildMdx,
    buildSheetCsvUrl,
    convertHtmlToMarkdown,
    envFlag,
    loadLocalEnvFiles,
    mergePostMetadata,
    parseBlogSheet,
    parseBlogSheetWithSummary,
    syncBlogPosts,
    writeGithubOutput,
} from '../sync-blogs.js';

const tempDirs: string[] = [];
const today = new Date('2026-04-30T00:00:00Z');

function createTempDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmbtv-sync-blogs-tests-'));
    tempDirs.push(dir);
    return dir;
}

function response(body: string, status = 200, statusText = 'OK') {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText,
        text: async () => body,
    };
}

function createFetch(csv: string, docs: Record<string, string>) {
    return vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/spreadsheets/')) return response(csv);

        for (const [docId, html] of Object.entries(docs)) {
            if (requestUrl === buildGoogleDocHtmlUrl(docId)) return response(html);
        }

        return response('Not found', 404, 'Not Found');
    });
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    delete process.env.GOOGLE_BLOG_SHEET_ID;
    delete process.env.GOOGLE_BLOG_SHEET_NAME;
});


describe('parseBlogSheet', () => {
    it('normalizes published rows from the Google Sheet contract', () => {
        const csv = [
            'slug,title,date,description,tags,google_doc_id,published',
            ',"My First Post",4/30/2026,"A short, useful summary","projects, google",https://docs.google.com/document/d/doc_123/edit,true',
            'draft-post,Draft,2026-04-29,Draft summary,drafts,doc_456,false',
        ].join('\n');

        const entries = parseBlogSheet(csv, { today });

        expect(entries).toHaveLength(1);
        expect(entries[0].docId).toBe('doc_123');
        expect(entries[0].post).toEqual({
            slug: 'my-first-post',
            title: 'My First Post',
            date: '2026-04-30',
            description: 'A short, useful summary',
            tags: ['projects', 'google'],
        });
    });

    it('reports duplicate slugs before any files are written', () => {
        const csv = [
            'slug,title,date,description,tags,google_doc_id,published',
            'dupe,First,2026-04-30,First summary,meta,doc_1,true',
            'dupe,Second,2026-04-30,Second summary,meta,doc_2,true',
        ].join('\n');

        expect(() => parseBlogSheet(csv, { today })).toThrow(/duplicate slug "dupe"/);
    });

    it('rejects invalid dates in published rows', () => {
        const csv = [
            'slug,title,date,description,tags,google_doc_id,published',
            'bad-date,Bad Date,2026-02-30,Summary,meta,doc_1,true',
        ].join('\n');

        expect(() => parseBlogSheet(csv, { today })).toThrow(/Invalid calendar date/);
    });

    it('summarizes rows skipped because they are not published', () => {
        const csv = [
            'slug,title,date,description,tags,google_doc_id,published',
            'draft-post,Draft Post,2026-04-30,Draft summary,draft,doc_1,false',
            'blank-status,Blank Status,2026-04-30,Blank summary,draft,doc_2,',
        ].join('\n');

        const summary = parseBlogSheetWithSummary(csv, { today });

        expect(summary.entries).toHaveLength(0);
        expect(summary.skippedRows).toEqual([
            {
                rowNumber: 2,
                slug: 'draft-post',
                title: 'Draft Post',
                published: 'false',
                reason: 'published is "false"',
            },
            {
                rowNumber: 3,
                slug: 'blank-status',
                title: 'Blank Status',
                published: '',
                reason: 'published is blank',
            },
        ]);
    });
});

describe('Google export helpers', () => {
    it('builds public export URLs for Sheets and Docs', () => {
        expect(buildSheetCsvUrl('sheet_123', 'Blog Posts'))
            .toBe('https://docs.google.com/spreadsheets/d/sheet_123/gviz/tq?tqx=out:csv&sheet=Blog%20Posts');
        expect(buildGoogleDocHtmlUrl('doc_123'))
            .toBe('https://docs.google.com/document/d/doc_123/export?format=html');
    });

    it('converts exported Google Docs HTML into markdown', () => {
        const markdown = convertHtmlToMarkdown(`
            <html>
              <head><title>Ignored</title><style>.c1 { color: red; }</style></head>
              <body>
                <h1>Hello</h1>
                <p>Read <a href="https://example.com">more</a>.</p>
                <ul><li>One</li><li>Two</li></ul>
                <pre><code>const x = 1;</code></pre>
              </body>
            </html>
        `);

        expect(markdown).toContain('# Hello');
        expect(markdown).toContain('[more](https://example.com)');
        expect(markdown).toContain('- One');
        expect(markdown).toContain('const x = 1;');
    });

    it('normalizes Google Docs title, code block, typed fences, and table exports', () => {
        const markdown = convertHtmlToMarkdown(`
                        <html>
                            <body>
                                <p class="title"><span>Doc Title</span></p>
                                <p>Intro paragraph.</p>
                                <p>\`\`\`text</p>
                                <p>typed fence body</p>
                                <p>\`\`\`</p>
                                <p>\uec03const REQUIRED_HEADERS = ['title', 'google_doc_id'];</p>
                                <p>const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;</p>
                                <p>\uec02</p>
                                <table>
                                    <tbody>
                                        <tr><td><p>some</p></td><td><p>values</p></td></tr>
                                        <tr><td><p>in</p></td><td><p>a table</p></td></tr>
                                    </tbody>
                                </table>
                            </body>
                        </html>
                `);

        expect(markdown).toContain('# Doc Title');
        expect(markdown).toContain('```text\ntyped fence body\n```');
        expect(markdown).toContain("```js\nconst REQUIRED_HEADERS = ['title', 'google_doc_id'];");
        expect(markdown).toContain('const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;\n```');
        expect(markdown).not.toContain('\uec03');
        expect(markdown).not.toContain('\uec02');
        expect(markdown).toContain('<div className="blog-table-scroll">');
        expect(markdown).toContain('<table className="blog-table">');
        expect(markdown).toContain('<td className="blog-table-cell">some</td><td className="blog-table-cell">values</td>');
    });

    it('does not collapse wrapper elements around Google Docs code block markers', () => {
        const markdown = convertHtmlToMarkdown(`
            <html>
                <body>
                    <div>
                        <p>Before.</p>
                        <p>\uec03const x = 1;</p>
                        <p>\uec02</p>
                        <p>After.</p>
                    </div>
                </body>
            </html>
        `);

        expect(markdown).toContain('Before.\n\n```js\nconst x = 1;\n```\n\nAfter.');
    });

    it('keeps table cells from swallowing neighboring cells when they contain code markers', () => {
        const markdown = convertHtmlToMarkdown(`
            <html>
                <body>
                    <p>Before table.</p>
                    <table>
                        <tbody>
                            <tr>
                                <td>
                                    <p>\uec03const x = 1;</p>
                                    <p>\uec02</p>
                                </td>
                                <td><p>After cell.</p></td>
                            </tr>
                        </tbody>
                    </table>
                    <p>After table.</p>
                </body>
            </html>
        `);

        expect(markdown).toContain('Before table.');
        expect(markdown).toContain('<td className="blog-table-cell"><pre><code className="language-js">const x = 1;</code></pre></td>');
        expect(markdown).toContain('<td className="blog-table-cell">After cell.</td>');
        expect(markdown).toContain('After table.');
    });

    it('preserves simple inline table cell markup and unwraps Google redirect links', () => {
        const markdown = convertHtmlToMarkdown(`
            <html>
                <body>
                    <p>
                        <a href="https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fpath%3Fx%3D1%26y%3D2&sa=D">Normal link</a>
                    </p>
                    <table>
                        <tbody>
                            <tr>
                                <td>
                                    <p>A<br>B</p>
                                    <p><a href="https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fpath%3Fx%3D1%26y%3D2&sa=D">Table link</a></p>
                                </td>
                                <td><p><strong>Bold</strong> and <code>{x}</code></p></td>
                            </tr>
                        </tbody>
                    </table>
                </body>
            </html>
        `);

        expect(markdown).toContain('[Normal link](https://example.com/path?x=1&y=2)');
        expect(markdown).toContain('<td className="blog-table-cell">A<br />B<br /><a href="https://example.com/path?x=1&amp;y=2">Table link</a></td>');
        expect(markdown).toContain('<td className="blog-table-cell"><strong>Bold</strong> and <code>&#123;x&#125;</code></td>');
    });

    it('drops unsafe link protocols and active embedded elements from Google Docs HTML', () => {
        const markdown = convertHtmlToMarkdown(`
            <html>
                <body>
                    <p>
                        Safe <a href="https://example.com">link</a>,
                        bad <a href="javascript:alert(1)">link</a>,
                        redirect <a href="https://www.google.com/url?q=javascript%3Aalert(2)&sa=D">link</a>.
                    </p>
                    <script>alert('nope')</script>
                    <iframe src="https://example.com/embed">Frame text</iframe>
                    <object data="https://example.com/object">Object text</object>
                </body>
            </html>
        `);

        expect(markdown).toContain('[link](https://example.com)');
        expect(markdown).toContain('bad link');
        expect(markdown).toContain('redirect link');
        expect(markdown).not.toContain('javascript:');
        expect(markdown).not.toContain('iframe');
        expect(markdown).not.toContain('Frame text');
        expect(markdown).not.toContain('Object text');
    });

    it('preserves safe images inside table cells and drops unsafe image sources', () => {
        const markdown = convertHtmlToMarkdown(`
            <html>
                <body>
                    <table>
                        <tbody>
                            <tr>
                                <td><p>Logo</p><p><img src="https://example.com/logo.png" alt="Logo" title="Example logo"></p></td>
                                <td><p><img src="javascript:alert(1)" alt="Bad"></p></td>
                            </tr>
                        </tbody>
                    </table>
                </body>
            </html>
        `);

        expect(markdown).toContain('<td className="blog-table-cell">Logo<br /><img src="https://example.com/logo.png" alt="Logo" title="Example logo" /></td>');
        expect(markdown).toContain('<td className="blog-table-cell"></td>');
        expect(markdown).not.toContain('javascript:');
        expect(markdown).not.toContain('alt="Bad"');
    });

    it('preserves useful Google Docs inline formatting as semantic markup', () => {
        const markdown = convertHtmlToMarkdown(`
            <html>
                <head>
                    <style>
                        .bold { font-weight: 700; }
                        .italic { font-style: italic; }
                        .highlight { background-color: #ffff00; }
                        .underline { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <p>
                        Opening paragraph.
                        <span class="highlight">State the problem</span>,
                        <span class="bold">key decision</span>,
                        <span class="italic">second key decision</span>,
                        <span class="bold highlight">important bit</span>,
                        and <span class="underline">underlined text</span>.
                    </p>
                    <table>
                        <tbody>
                            <tr><td><p><span class="bold highlight">Header</span></p></td></tr>
                        </tbody>
                    </table>
                </body>
            </html>
        `);

        expect(markdown).toContain('<mark>State the problem</mark>');
        expect(markdown).toContain('**key decision**');
        expect(markdown).toContain('_second key decision_');
        expect(markdown).toContain('<mark><strong>important bit</strong></mark>');
        expect(markdown).toContain('<u>underlined text</u>');
        expect(markdown).toContain('<td className="blog-table-cell"><mark><strong>Header</strong></mark></td>');
    });

    it('removes orphan typed code fence markers from Google Docs exports', () => {
        const markdown = convertHtmlToMarkdown(`
            <html>
                <body>
                    <p>Before.</p>
                    <p>\`\`\`text</p>
                    <p>Between.</p>
                    <p>\uec03const value = new Set(['x']);</p>
                    <p>\uec02</p>
                </body>
            </html>
        `);

        expect(markdown).toContain('Before.');
        expect(markdown).toContain('Between.');
        expect(markdown).toContain("```js\nconst value = new Set(['x']);\n```");
        expect(markdown).not.toContain('```text');
    });

    it('builds MDX with JSON-safe frontmatter values', () => {
        const mdx = buildMdx({
            slug: 'quoted',
            title: 'A "quoted" title',
            date: '2026-04-30',
            description: 'A summary with: punctuation',
            tags: ['projects', 'google'],
        }, '# Body');

        expect(mdx).toContain('title: "A \\"quoted\\" title"');
        expect(mdx).toContain('tags: ["projects","google"]');
        expect(mdx).toContain('\n# Body\n');
    });
});

describe('local env loading', () => {
    it('loads blog sync variables from local env files while preserving shell env', () => {
        const repoRoot = createTempDir();
        fs.writeFileSync(path.join(repoRoot, '.env'), [
            'GOOGLE_BLOG_SHEET_ID=from-env',
            'GOOGLE_BLOG_SHEET_NAME=Ignored Sheet',
        ].join('\n'));
        fs.writeFileSync(path.join(repoRoot, '.env.local'), [
            'GOOGLE_BLOG_SHEET_NAME="Blog Posts"',
        ].join('\n'));

        process.env.GOOGLE_BLOG_SHEET_ID = 'already-set';
        loadLocalEnvFiles({ repoRoot });

        expect(process.env.GOOGLE_BLOG_SHEET_ID).toBe('already-set');
        expect(process.env.GOOGLE_BLOG_SHEET_NAME).toBe('Blog Posts');
    });
});

describe('mergePostMetadata', () => {
    it('preserves existing local posts by default and lets synced posts override by slug', () => {
        const merged = mergePostMetadata(
            [
                { slug: 'manual', title: 'Manual', date: '2026-03-01', description: 'Manual', tags: [] },
                { slug: 'synced', title: 'Old synced', date: '2026-03-01', description: 'Old', tags: [] },
            ],
            [
                { slug: 'synced', title: 'New synced', date: '2026-04-30', description: 'New', tags: ['google'] },
            ],
        );

        expect(merged.map((post) => post.slug)).toEqual(['synced', 'manual']);
        expect(merged[0].title).toBe('New synced');
    });

    it('can replace posts.json entirely when requested', () => {
        const merged = mergePostMetadata(
            [{ slug: 'manual', title: 'Manual', date: '2026-03-01', description: 'Manual', tags: [] }],
            [{ slug: 'synced', title: 'Synced', date: '2026-04-30', description: 'Synced', tags: [] }],
            { replaceAll: true },
        );

        expect(merged.map((post) => post.slug)).toEqual(['synced']);
    });
});

describe('envFlag', () => {
    it('supports explicit false values and caller-provided defaults', () => {
        expect(envFlag(undefined, true)).toBe(true);
        expect(envFlag('', true)).toBe(true);
        expect(envFlag('false', true)).toBe(false);
        expect(envFlag('off', true)).toBe(false);
        expect(envFlag('yes', false)).toBe(true);
    });
});

describe('syncBlogPosts', () => {
    it('defaults to Sheet-authoritative posts.json and MDX generation', async () => {
        const repoRoot = createTempDir();
        const postsPath = path.join(repoRoot, 'src/content/posts.json');
        fs.mkdirSync(path.dirname(postsPath), { recursive: true });
        fs.writeFileSync(postsPath, JSON.stringify([
            { slug: 'manual', title: 'Manual', date: '2026-03-01', description: 'Manual', tags: [] },
        ], null, 4) + '\n');

        const csv = [
            'slug,title,date,description,tags,google_doc_id,published',
            'synced-post,Synced Post,2026-04-30,Synced summary,"google, mdx",doc_123,true',
            'draft-post,Draft Post,2026-04-30,Draft summary,draft,doc_456,false',
        ].join('\n');
        const fetchImpl = createFetch(csv, {
            doc_123: '<html><body><h1>Synced Post</h1><p>Published body.</p></body></html>',
        });

        const firstRun = await syncBlogPosts({
            sheetId: 'sheet_123',
            repoRoot,
            today,
            fetchImpl,
        });

        expect(firstRun.changed).toBe(true);
        expect(firstRun.fetchedRows).toBe(2);
        expect(firstRun.syncedPosts).toBe(1);
        expect(firstRun.publishedRows).toEqual([
            {
                rowNumber: 2,
                slug: 'synced-post',
                title: 'Synced Post',
                date: '2026-04-30',
                docId: 'doc_123',
            },
        ]);
        expect(firstRun.skippedRows).toEqual([
            {
                rowNumber: 3,
                slug: 'draft-post',
                title: 'Draft Post',
                published: 'false',
                reason: 'published is "false"',
            },
        ]);
        expect(firstRun.changedFileLabels).toEqual([
            'src/content/posts.json',
            'src/content/blog/synced-post.mdx',
        ]);
        const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
        expect(posts.map((post: { slug: string }) => post.slug)).toEqual(['synced-post']);
        expect(fs.readFileSync(path.join(repoRoot, 'src/content/blog/synced-post.mdx'), 'utf-8'))
            .toContain('Published body.');

        const secondRun = await syncBlogPosts({
            sheetId: 'sheet_123',
            repoRoot,
            today,
            fetchImpl,
        });
        expect(secondRun.changed).toBe(false);
    });

    it('can preserve local metadata when replaceAll is disabled', async () => {
        const repoRoot = createTempDir();
        const postsPath = path.join(repoRoot, 'src/content/posts.json');
        fs.mkdirSync(path.dirname(postsPath), { recursive: true });
        fs.writeFileSync(postsPath, JSON.stringify([
            { slug: 'manual', title: 'Manual', date: '2026-03-01', description: 'Manual', tags: [] },
        ]));

        const csv = [
            'slug,title,date,description,tags,google_doc_id,published',
            'synced-post,Synced Post,2026-04-30,Synced summary,google,doc_123,true',
        ].join('\n');
        const fetchImpl = createFetch(csv, {
            doc_123: '<html><body><p>Published body.</p></body></html>',
        });

        await syncBlogPosts({ sheetId: 'sheet_123', repoRoot, today, fetchImpl, replaceAll: false });

        const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
        expect(posts.map((post: { slug: string }) => post.slug)).toEqual(['synced-post', 'manual']);
    });

    it('removes stale generated MDX files in Sheet-authoritative mode', async () => {
        const repoRoot = createTempDir();
        const blogDir = path.join(repoRoot, 'src/content/blog');
        fs.mkdirSync(blogDir, { recursive: true });
        fs.writeFileSync(path.join(blogDir, 'old-post.mdx'), '# Old post');

        const csv = [
            'slug,title,date,description,tags,google_doc_id,published',
            'synced-post,Synced Post,2026-04-30,Synced summary,google,doc_123,true',
        ].join('\n');
        const fetchImpl = createFetch(csv, {
            doc_123: '<html><body><p>Published body.</p></body></html>',
        });

        const result = await syncBlogPosts({ sheetId: 'sheet_123', repoRoot, today, fetchImpl });

        expect(fs.existsSync(path.join(blogDir, 'old-post.mdx'))).toBe(false);
        expect(fs.existsSync(path.join(blogDir, 'synced-post.mdx'))).toBe(true);
        expect(result.changedFileLabels).toContain('src/content/blog/old-post.mdx');
    });
});

describe('writeGithubOutput', () => {
    it('appends changed output for GitHub Actions', () => {
        const dir = createTempDir();
        const outputPath = path.join(dir, 'github-output.txt');

        writeGithubOutput(outputPath, true);
        writeGithubOutput(outputPath, false);

        expect(fs.readFileSync(outputPath, 'utf-8')).toBe('changed=true\nchanged=false\n');
    });
});
