import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createProcessor } from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter';
import type { Expression, Program, SpreadElement } from 'estree';
import type { Plugin, ResolvedConfig } from 'vite';
import { projects } from '../src/content/projects.ts';
import type { SiteSearchDocument } from '../src/content/siteSearch.ts';
import { readPostRegistry } from './post-registry.ts';
import type { TripManifest } from '../shared/tripManifestSchema.ts';

const moduleId = 'virtual:site-search';
const textProperties = new Set(['title', 'description', 'summary', 'label', 'caption', 'alt', 'name', 'text', 'notes', 'stack', 'tech', 'placeholder']);
const mdx = createProcessor({ remarkPlugins: [remarkFrontmatter] });
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();

interface StaticExpression {
    data?: { estree?: Program | null };
}

function literalText(expression: Expression | SpreadElement | null): string[] {
    if (expression?.type === 'Literal' && typeof expression.value === 'string') return [expression.value];
    if (expression?.type === 'TemplateLiteral' && expression.expressions.length === 0) {
        return expression.quasis.map(part => part.value.cooked ?? part.value.raw);
    }
    if (expression?.type === 'ArrayExpression') return expression.elements.flatMap(literalText);
    return [];
}

function expressionText(node: StaticExpression): string[] {
    const statements = node.data?.estree?.body;
    const statement = statements?.length === 1 ? statements[0] : undefined;
    return statement?.type === 'ExpressionStatement' ? literalText(statement.expression) : [];
}

/** Read authored text without executing articles or including their JSX/configuration. */
export function extractArticleText(source: string): string {
    interface TextNode extends StaticExpression {
        type: string;
        value?: string;
        alt?: string;
        children?: TextNode[];
        attributes?: { name?: string; value?: string | StaticExpression | null }[];
    }
    const text: string[] = [];
    function visit(node: TextNode) {
        if (['text', 'inlineCode', 'code'].includes(node.type) && node.value) text.push(node.value);
        if (node.type === 'image' && node.alt) text.push(node.alt);
        if (node.type === 'mdxTextExpression' || node.type === 'mdxFlowExpression') text.push(...expressionText(node));
        for (const attribute of node.attributes ?? []) {
            if (!textProperties.has(attribute.name ?? '')) continue;
            if (typeof attribute.value === 'string') text.push(attribute.value);
            else if (attribute.value) text.push(...expressionText(attribute.value));
        }
        for (const child of node.children ?? []) visit(child);
    }
    visit(mdx.parse(source) as TextNode);
    return compact(text.join(' '));
}

export function extractPageText(source: string): string {
    const file = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const text: string[] = [];
    function literals(node: ts.Expression): string[] {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
        if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(literals);
        return [];
    }
    function visit(node: ts.Node) {
        if (ts.isJsxAttribute(node) && !textProperties.has(node.name.getText(file))) return;
        if (ts.isJsxText(node)) text.push(node.text);
        if (ts.isJsxExpression(node) && node.expression) {
            const parent = node.parent;
            if (!ts.isJsxAttribute(parent) || textProperties.has(parent.name.getText(file))) text.push(...literals(node.expression));
        }
        if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)
            && textProperties.has(node.name.getText(file))) text.push(node.initializer.text);
        if (ts.isPropertyAssignment(node) && textProperties.has(node.name.getText(file).replace(/^['"]|['"]$/g, ''))) {
            text.push(...literals(node.initializer));
        }
        ts.forEachChild(node, visit);
    }
    visit(file);
    return compact(text.join(' '));
}

function importedFiles(file: string, source: string): string[] {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const files: string[] = [];
    function visit(node: ts.Node) {
        const specifier = ts.isImportDeclaration(node) ? node.moduleSpecifier
            : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
        if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
            const base = path.resolve(path.dirname(file), specifier.text);
            const resolved = [base, `${base}.tsx`, path.join(base, 'index.tsx')]
                .find(candidate => candidate.endsWith('.tsx') && fs.existsSync(candidate));
            if (resolved) files.push(resolved);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    return files;
}

function pageSources(root: string, watch: (file: string) => void): Map<string, string> {
    const loaderFile = path.join(root, 'src/navigation/pageLoaders.ts');
    watch(loaderFile);
    const sources = new Map([['/', path.join(root, 'src/pages/Home.tsx')]]);
    const ast = ts.createSourceFile(loaderFile, fs.readFileSync(loaderFile, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
        if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && node.name.text.startsWith('/')) {
            const file = importedFiles(loaderFile, node.initializer.getText(ast))[0];
            if (file) sources.set(node.name.text, file);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    return sources;
}

function tripText(value: unknown, key = ''): string[] {
    if (typeof value === 'string') return textProperties.has(key) || ['regions', 'motorcycle', 'model', 'make'].includes(key) ? [value] : [];
    if (Array.isArray(value)) return value.flatMap(item => tripText(item, key));
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => tripText(item, key));
    return [];
}

export function buildSiteSearchIndex(config: Pick<ResolvedConfig, 'root' | 'mode' | 'command'>, watch: (file: string) => void = () => {}): SiteSearchDocument[] {
    const production = config.command === 'build' && config.mode !== 'development';
    const contentDir = path.join(config.root, config.mode === 'trip-test' ? 'tests/fixtures/trip-content' : 'src/content');
    const metadataFile = path.join(config.root, 'src/content/sitePages.json');
    const metadata: Record<string, { title: string; description: string }> = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    watch(metadataFile);
    watch(path.join(config.root, 'src/content/projects.ts'));
    const sources = pageSources(config.root, watch);
    const pageTextCache = new Map<string, string>();
    function pageText(file: string, visited = new Set<string>()): string {
        if (visited.has(file) || !fs.existsSync(file)) return '';
        visited.add(file);
        watch(file);
        const source = fs.readFileSync(file, 'utf8');
        let text = pageTextCache.get(file);
        if (text === undefined) {
            text = extractPageText(source);
            pageTextCache.set(file, text);
        }
        return [text, ...importedFiles(file, source).map(imported => pageText(imported, visited))].join(' ');
    }

    const documents: SiteSearchDocument[] = Object.entries(metadata).map(([url, page]) => {
        const project = projects.find(project => url === `/projects/${project.slug}` || url.startsWith(`/projects/${project.slug}/`));
        const source = sources.get(url);
        const isMap = url.endsWith('/map');
        return {
            url,
            title: isMap && project?.slug !== 'adv-atlas' ? `${page.title} map` : url === '/' ? 'Home' : page.title,
            description: page.description,
            kind: isMap ? 'Map' : project ? 'Project' : 'Page',
            keywords: project ? [project.slug, ...project.tech].join(' ') : undefined,
            content: compact([
                source ? pageText(source) : '', project?.description ?? '', project?.summary ?? '',
                ...(project?.changelog?.flatMap(entry => entry.notes) ?? []),
            ].join(' ')),
        };
    });

    const postsFile = path.join(contentDir, 'posts.json');
    watch(postsFile);
    const posts = readPostRegistry(postsFile, production);
    for (const post of posts) {
        const bodyFile = path.join(contentDir, 'blog', `${post.slug}.mdx`);
        watch(bodyFile);
        const available = post.development?.contentAvailable !== false && fs.existsSync(bodyFile);
        let manifest: Pick<TripManifest, 'countries'> | undefined;
        if (post.tripId) {
            const manifestFile = path.join(contentDir, 'trips', `${post.tripId}.json`);
            watch(manifestFile);
            if (fs.existsSync(manifestFile)) {
                try {
                    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
                } catch (error) {
                    if (production) throw error;
                }
            }
        }
        const countries = [...(post.countries ?? []), ...(manifest?.countries ?? [])];
        documents.push({
            url: `/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`,
            title: post.title,
            description: post.description,
            kind: post.format === 'trip' ? 'Trip report' : 'Post',
            keywords: [post.slug, post.date, post.tripId ?? '', ...post.tags, post.series?.title ?? '',
                ...countries.flatMap(country => [country.code, countryNames.of(country.code) ?? country.code, ...(country.regions ?? [])])].join(' '),
            content: compact([available ? extractArticleText(fs.readFileSync(bodyFile, 'utf8')) : '', ...tripText(manifest)].join(' ')),
            ...(!production && post.development?.published === false ? { draft: true } : {}),
        });
    }
    return documents;
}

export function siteSearchPlugin(): Plugin {
    let config: ResolvedConfig;
    const watched = new Set<string>();
    return {
        name: 'site-search',
        configResolved(value) { config = value; },
        resolveId(id) { if (id === moduleId) return `\0${id}`; },
        load(id) {
            if (id !== `\0${moduleId}`) return;
            watched.clear();
            const documents = buildSiteSearchIndex(config, file => {
                watched.add(file);
                if (fs.existsSync(file)) this.addWatchFile(file);
            });
            return `export const documents = ${JSON.stringify(documents)};`;
        },
        handleHotUpdate({ file, server }) {
            if (!watched.has(file)) return;
            const module = server.moduleGraph.getModuleById(`\0${moduleId}`);
            if (module) server.moduleGraph.invalidateModule(module);
            server.ws.send({ type: 'full-reload' });
        },
    };
}
