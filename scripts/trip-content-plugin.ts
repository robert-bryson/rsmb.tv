import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { tripManifestSchema, type TripManifest, type TripSummary } from '../shared/tripManifestSchema.ts';
import { validateBundledTripMedia } from './trip-media-assets.ts';
import { articleMetadata, staticPageMetadata, STATIC_PAGE_PATHS } from '../src/utils/pageMetadata.ts';
import { pageMetadataHtml } from './pageMetadataHtml.ts';
import siteAliases from '../src/content/siteAliases.json' with { type: 'json' };

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
            const production = config.command === 'build' && config.mode !== 'development';
            const posts = readPosts(postsPath, production);
            if (fs.existsSync(postsPath)) this.addWatchFile(postsPath);
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
            const summaries: Record<string, TripSummary> = {};
            const issues: Record<string, string> = {};
            const loaders: string[] = [];
            const filenames = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
            for (const filename of filenames.filter(filename => filename.endsWith('.json'))) {
                const tripId = filename.slice(0, -5);
                if (production && !referenced.has(tripId)) continue;
                const file = path.join(directory, filename);
                this.addWatchFile(file);
                try {
                    const manifest = tripManifestSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
                    if (manifest.id !== tripId) throw new Error(`Manifest id must match filename: ${tripId}`);
                    for (const asset of validateBundledTripMedia(manifest, { repoRoot: config.root })) this.addWatchFile(asset);
                    summaries[tripId] = summary(manifest, config.command === 'serve');
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
            const development = config.mode === 'development';
            const posts = readPosts(postsPath, !development);
            const visible = posts.filter(post => development || post.development?.published !== false);
            validatePostReferences(visible, !development);
            const originalTemplate = String(template.source);
            for (const pathname of STATIC_PAGE_PATHS) {
                const source = pageMetadataHtml(originalTemplate, staticPageMetadata(pathname, visible));
                if (pathname === '/') template.source = source;
                else this.emitFile({ type: 'asset', fileName: `${pathname.slice(1)}.html`, source });
            }
            for (const [alias, pathname] of Object.entries(siteAliases)) {
                this.emitFile({ type: 'asset', fileName: `${alias.slice(1)}.html`, source: pageMetadataHtml(originalTemplate, staticPageMetadata(pathname, visible)) });
            }
            for (const post of visible) {
                let manifest: TripManifest | undefined;
                if (post.tripId) {
                    try {
                        manifest = tripManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(config.root, contentDir, 'trips', `${post.tripId}.json`), 'utf8')));
                    } catch (error) {
                        if (!development) throw error;
                    }
                }
                const hero = manifest?.photos.find(photo => photo.id === manifest.hero);
                const source = pageMetadataHtml(originalTemplate, articleMetadata(post, hero));
                // Both historic collections still redirect client-side to the canonical collection.
                for (const collection of ['blog', 'trips']) this.emitFile({ type: 'asset', fileName: `${collection}/${post.slug}.html`, source });
            }
        } },
        transformIndexHtml(html) {
            if (config.mode !== 'development') return;
            return {
                html: html.replace(/<meta\s+name="robots"[^>]*>/g, ''),
                tags: [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' as const }],
            };
        },
        configurePreviewServer(server) {
            server.middlewares.use((request, _response, next) => {
                const url = new URL(request.url ?? '/', 'http://localhost');
                const pathname = url.pathname.replace(/\/$/, '');
                if (STATIC_PAGE_PATHS.includes(pathname) || Object.hasOwn(siteAliases, pathname) || /^\/(blog|trips)\/[a-z0-9-]+$/.test(pathname)) {
                    const htmlPath = `${pathname}.html`;
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
function summary(manifest: TripManifest, local: boolean): TripSummary {
    const hero = manifest.photos.find(photo => photo.id === manifest.hero)!;
    const url = (value: string) => local ? value.replaceAll('https://data.rsmb.tv/trips/', '/data/trips/') : value;
    return {
        id: manifest.id, dates: manifest.dates, ridingDays: manifest.ridingDays,
        distanceMiles: manifest.distanceMiles, series: manifest.series, motorcycle: manifest.motorcycle, regions: manifest.regions,
        countries: manifest.countries,
        hero: { ...hero, src: url(hero.src), srcSet: hero.srcSet && url(hero.srcSet) },
        route: { geoJson: url(manifest.route.geoJson), ...(manifest.route.alt ? { alt: manifest.route.alt } : {}) },
    };
}

interface PostMeta {
    slug: string; title: string; description: string; date: string; tags: string[];
    format?: string; tripId?: string; development?: { published: boolean };
}
function readPosts(postsPath: string, production: boolean): PostMeta[] {
    if (fs.existsSync(postsPath)) return JSON.parse(fs.readFileSync(postsPath, 'utf8'));
    if (production) throw new Error('Missing post registry. Run blog sync before the production build.');
    return [];
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

export function articleHtml(template: string, post: PostMeta, hero?: string) {
    return pageMetadataHtml(template, articleMetadata(post, hero ? { src: hero } : undefined));
}
