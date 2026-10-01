import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { tripManifestSchema, type TripManifest } from '../shared/tripManifestSchema.ts';

/** Generate a small card registry, with full manifests behind async imports. */
export function tripContentPlugin(): Plugin {
    let config: ResolvedConfig;
    const moduleId = 'virtual:trip-content';
    return {
        name: 'trip-content',
        configResolved(value) { config = value; },
        resolveId(id) { if (id === moduleId || id === 'virtual:post-content') return `\0${id}`; },
        load(id) {
            if (id !== `\0${moduleId}` && id !== '\0virtual:post-content') return;
            const contentDir = config.mode === 'trip-test' ? 'tests/fixtures/trip-content' : 'src/content';
            const postsPath = path.join(config.root, contentDir, 'posts.json');
            this.addWatchFile(postsPath);
            const posts: PostMeta[] = fs.existsSync(postsPath)
                ? JSON.parse(fs.readFileSync(postsPath, 'utf8')) : [];
            const production = config.command === 'build';
            validatePostReferences(posts.filter(post => !production || post.development?.published !== false), production);
            if (id === '\0virtual:post-content') {
                const visible = posts.filter(post => !production || post.development?.published !== false);
                const metadata = visible.map(post => {
                    if (!production) return post;
                    const publicPost = { ...post };
                    delete publicPost.development;
                    return publicPost;
                });
                const loaders = visible.flatMap(post => {
                    const file = path.join(config.root, contentDir, 'blog', `${post.slug}.mdx`);
                    if (!fs.existsSync(file)) {
                        if (production) throw new Error(`Missing published post content: ${post.slug}`);
                        return [];
                    }
                    this.addWatchFile(file);
                    return [`${JSON.stringify(`./blog/${post.slug}.mdx`)}: () => import(${JSON.stringify(`/${contentDir}/blog/${post.slug}.mdx`)})`];
                });
                return `export const metadata = ${JSON.stringify(metadata)}; export const mdxLoaders = {${loaders.join(',')}};`;
            }
            const referenced = new Set(posts.filter(p => !production || p.development?.published !== false).map(p => p.tripId));
            const directory = path.join(config.root, contentDir, 'trips');
            const summaries: Record<string, unknown> = {};
            const issues: Record<string, string> = {};
            const loaders: string[] = [];
            for (const filename of fs.readdirSync(directory).filter(f => f.endsWith('.json'))) {
                const tripId = filename.slice(0, -5);
                if (production && !referenced.has(tripId)) continue;
                const file = path.join(directory, filename);
                this.addWatchFile(file);
                try {
                    const manifest = tripManifestSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
                    if (manifest.id !== tripId) throw new Error(`Manifest id must match filename: ${tripId}`);
                    summaries[tripId] = summary(manifest, !production);
                    loaders.push(`${JSON.stringify(tripId)}: () => import(${JSON.stringify(`/${contentDir}/trips/${filename}`)})`);
                } catch (error) {
                    const message = `Trip ${tripId}: ${error instanceof Error ? error.message : String(error)}`;
                    if (production) throw new Error(message, { cause: error });
                    issues[tripId] = message;
                }
            }
            for (const tripId of referenced) {
                if (tripId && !Object.hasOwn(summaries, tripId) && production) throw new Error(`Missing published trip manifest: ${tripId}`);
            }
            return `export const summaries = ${JSON.stringify(summaries)}; export const issues = ${JSON.stringify(issues)}; export const loaders = {${loaders.join(',')}};`;
        },
        generateBundle: { order: 'post', handler(_options, bundle) {
            const template = bundle['index.html'];
            if (template?.type !== 'asset') return;
            const contentDir = config.mode === 'trip-test' ? 'tests/fixtures/trip-content' : 'src/content';
            const postsPath = path.join(config.root, contentDir, 'posts.json');
            const posts: PostMeta[] = fs.existsSync(postsPath) ? JSON.parse(fs.readFileSync(postsPath, 'utf8')) : [];
            const published = posts.filter(post => post.development?.published !== false);
            validatePostReferences(published, true);
            for (const post of published) {
                const manifest = post.tripId ? tripManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(config.root, contentDir, 'trips', `${post.tripId}.json`), 'utf8'))) : undefined;
                const source = articleHtml(String(template.source), post, manifest?.photos.find(photo => photo.id === manifest.hero)?.src);
                // Both historic collections still redirect client-side to the canonical collection.
                for (const collection of ['blog', 'trips']) this.emitFile({ type: 'asset', fileName: `${collection}/${post.slug}.html`, source });
            }
        } },
        configurePreviewServer(server) {
            server.middlewares.use((request, _response, next) => {
                const url = new URL(request.url ?? '/', 'http://localhost');
                if (/^\/(blog|trips)\/[a-z0-9-]+\/?$/.test(url.pathname)) {
                    const htmlPath = `${url.pathname.replace(/\/$/, '')}.html`;
                    if (fs.existsSync(path.resolve(config.root, config.build.outDir, `.${htmlPath}`))) request.url = htmlPath + url.search;
                }
                next();
            });
        },
        handleHotUpdate({ file, server }) {
            if (file.includes('/content/trips/') || file.endsWith('/content/posts.json')) {
                for (const id of [moduleId, 'virtual:post-content']) { const module = server.moduleGraph.getModuleById(`\0${id}`); if (module) server.moduleGraph.invalidateModule(module); }
                server.ws.send({ type: 'full-reload' });
            }
        },
    };
}
function summary(manifest: TripManifest, local: boolean) {
    const hero = manifest.photos.find(photo => photo.id === manifest.hero)!;
    const url = (value: string) => local ? value.replaceAll('https://data.rsmb.tv/trips/', '/data/trips/') : value;
    return {
        id: manifest.id, dates: manifest.dates, ridingDays: manifest.ridingDays,
        distanceMiles: manifest.distanceMiles, series: manifest.series, motorcycle: manifest.motorcycle, regions: manifest.regions,
        hero: { ...hero, src: url(hero.src), srcSet: hero.srcSet && url(hero.srcSet) },
    };
}

interface PostMeta {
    slug: string; title: string; description: string; date: string; tags: string[];
    format?: string; tripId?: string; development?: { published: boolean };
}
function validatePostReferences(posts: PostMeta[], production: boolean) {
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const slugs = new Set<string>();
    for (const post of posts) {
        if (typeof post.slug !== 'string' || !slugPattern.test(post.slug)) {
            throw new Error(`Invalid post slug: ${post.slug}`);
        }
        if (slugs.has(post.slug)) throw new Error(`Duplicate post slug: ${post.slug}`);
        slugs.add(post.slug);
        if (post.tripId !== undefined && (typeof post.tripId !== 'string' || !slugPattern.test(post.tripId))) {
            throw new Error(`Invalid trip ID for post ${post.slug}: ${post.tripId}`);
        }
        if (production && post.format === 'trip' && !post.tripId) {
            throw new Error(`Missing trip ID for published post: ${post.slug}`);
        }
    }
}

function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
export function articleHtml(template: string, post: PostMeta, hero?: string) {
    const url = `https://rsmb.tv/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`;
    const title = `${post.title} — rsmb`;
    const image = hero ?? `https://rsmb.tv/og/blog/${post.slug}.svg`;
    const values: Record<string, string> = { description: post.description, 'og:title': title, 'og:description': post.description, 'og:image': image,
        'og:type': 'article', 'og:url': url, 'twitter:title': title, 'twitter:description': post.description, 'twitter:image': image };
    let html = template.replace(/<title>.*?<\/title>/s, () => `<title>${escapeHtml(title)}</title>`);
    html = html.replace(/<meta\s+(?:name|property)="([^"]+)"[^>]*>/g, (tag, key: string) => values[key] === undefined ? tag : `<meta ${key.startsWith('og:') ? 'property' : 'name'}="${key}" content="${escapeHtml(values[key])}" />`);
    html = html.replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${url}" />`);
    const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.description, datePublished: post.date, url, image, author: { '@type': 'Person', name: 'Robby Bryson' } }).replaceAll('<', '\\u003c');
    return html.replace('</head>', () => `<meta property="article:published_time" content="${escapeHtml(post.date)}" data-prerendered /><script type="application/ld+json" data-prerendered>${schema}</script></head>`);
}
