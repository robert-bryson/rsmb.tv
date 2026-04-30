#!/usr/bin/env node

/**
 * sync-blogs.js
 * =============
 * Syncs blog metadata from a public Google Sheet and published post bodies
 * from Google Docs into the local MDX blog registry.
 *
 * USAGE
 * -----
 *   GOOGLE_BLOG_SHEET_ID=<sheet-id> node scripts/sync-blogs.js
 *   GOOGLE_BLOG_SHEET_ID=<sheet-id> npm run sync-blogs
 *
 * ENVIRONMENT VARIABLES
 * ---------------------
 *   GOOGLE_BLOG_SHEET_ID       Required Google Sheet ID.
 *   GOOGLE_BLOG_SHEET_NAME     Optional tab name, defaults to "Blog Posts".
 *   GOOGLE_BLOG_REPLACE_ALL    Optional. Defaults to true so Google Sheets is
 *                              the blog source of truth. Set false only if
 *                              intentionally mixing generated and local posts.
 *
 * EXPECTED SHEET COLUMNS
 * ----------------------
 *   slug,title,date,description,tags,google_doc_id,published
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const LOCAL_ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local'];

export const DEFAULT_BLOG_SHEET_NAME = 'Blog Posts';

const REQUIRED_HEADERS = ['title', 'date', 'description', 'tags', 'google_doc_id', 'published'];
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'published']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GOOGLE_DOCS_CODE_BLOCK_START = '\uec03';
const GOOGLE_DOCS_CODE_BLOCK_END = '\uec02';
const ESCAPED_CODE_FENCE_PATTERN = /^\\`\\`\\`(.*)$/gm;
const UNSUPPORTED_GOOGLE_DOCS_ELEMENTS = [
    'audio',
    'button',
    'canvas',
    'embed',
    'form',
    'iframe',
    'input',
    'math',
    'object',
    'option',
    'select',
    'source',
    'svg',
    'textarea',
    'track',
    'video',
].join(',');
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_MEDIA_PROTOCOLS = new Set(['http:', 'https:']);

const LANGUAGE_ALIASES = new Map([
    ['bash', 'bash'],
    ['console', 'console'],
    ['css', 'css'],
    ['html', 'html'],
    ['javascript', 'js'],
    ['js', 'js'],
    ['json', 'json'],
    ['jsx', 'jsx'],
    ['markdown', 'md'],
    ['md', 'md'],
    ['python', 'py'],
    ['py', 'py'],
    ['shell', 'bash'],
    ['sh', 'bash'],
    ['sql', 'sql'],
    ['text', 'text'],
    ['tsx', 'tsx'],
    ['typescript', 'ts'],
    ['ts', 'ts'],
    ['yaml', 'yaml'],
    ['yml', 'yaml'],
]);

const HEADER_ALIASES = {
    doc_id: 'google_doc_id',
    document_id: 'google_doc_id',
    google_document_id: 'google_doc_id',
    google_doc: 'google_doc_id',
    publish: 'published',
    is_published: 'published',
};

function stripEnvValueQuotes(value) {
    const trimmed = String(value ?? '').trim();
    const quote = trimmed[0];
    if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function loadEnvFile(filePath, { fsImpl = fs, protectedEnvKeys = new Set() } = {}) {
    if (!fsImpl.existsSync(filePath)) return;

    for (const line of fsImpl.readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const assignment = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
        const separatorIndex = assignment.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = assignment.slice(0, separatorIndex).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || protectedEnvKeys.has(key)) continue;

        process.env[key] = stripEnvValueQuotes(assignment.slice(separatorIndex + 1));
    }
}

export function loadLocalEnvFiles({ repoRoot = REPO_ROOT, fsImpl = fs } = {}) {
    const protectedEnvKeys = new Set(Object.keys(process.env));

    for (const fileName of LOCAL_ENV_FILES) {
        loadEnvFile(path.join(repoRoot, fileName), { fsImpl, protectedEnvKeys });
    }
}

function normalizeHeader(header) {
    const normalized = String(header ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    return HEADER_ALIASES[normalized] || normalized;
}

function formatIsoDate(year, month, day) {
    return [
        String(year).padStart(4, '0'),
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0'),
    ].join('-');
}

export function buildSheetCsvUrl(sheetId, sheetName = DEFAULT_BLOG_SHEET_NAME) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

export function buildGoogleDocHtmlUrl(docId) {
    return `https://docs.google.com/document/d/${docId}/export?format=html`;
}

export function parseCsv(csv) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    function finishField() {
        row.push(field);
        field = '';
    }

    function finishRow() {
        finishField();
        if (row.some((cell) => cell.trim() !== '')) rows.push(row);
        row = [];
    }

    for (let index = 0; index < csv.length; index++) {
        const char = csv[index];

        if (char === '"') {
            if (inQuotes && csv[index + 1] === '"') {
                field += '"';
                index++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            finishField();
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            finishRow();
            if (char === '\r' && csv[index + 1] === '\n') index++;
        } else {
            field += char;
        }
    }

    if (field.length > 0 || row.length > 0) finishRow();

    if (inQuotes) {
        throw new Error('Invalid CSV: unterminated quoted field');
    }

    return rows;
}

function parseRecords(rows) {
    if (rows.length === 0) {
        throw new Error('The blog sheet is empty.');
    }

    const headers = rows[0].map(normalizeHeader);
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
    if (missingHeaders.length > 0) {
        throw new Error(`Missing required column(s): ${missingHeaders.join(', ')}`);
    }

    return rows.slice(1).map((row, index) => {
        const values = {};
        headers.forEach((header, columnIndex) => {
            if (!header) return;
            values[header] = (row[columnIndex] ?? '').trim();
        });
        return { rowNumber: index + 2, values };
    });
}

export function isPublished(value) {
    return TRUE_VALUES.has(String(value ?? '').trim().toLowerCase());
}

export function slugifyTitle(title) {
    return String(title ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function normalizeTags(value) {
    return String(value ?? '')
        .split(/[|,]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
}

export function extractGoogleDocId(value) {
    const trimmed = String(value ?? '').trim();
    const urlMatch = trimmed.match(/\/document\/d\/(?:e\/)?([^/]+)/);
    if (urlMatch) return urlMatch[1];
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
    return '';
}

export function normalizeDate(value, { today = new Date() } = {}) {
    const trimmed = String(value ?? '').trim();
    let year;
    let month;
    let day;

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (isoMatch) {
        year = Number(isoMatch[1]);
        month = Number(isoMatch[2]);
        day = Number(isoMatch[3]);
    } else if (slashMatch) {
        month = Number(slashMatch[1]);
        day = Number(slashMatch[2]);
        year = Number(slashMatch[3]);
    } else {
        throw new Error(`Invalid date "${trimmed}". Expected YYYY-MM-DD or M/D/YYYY.`);
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== day
    ) {
        throw new Error(`Invalid calendar date "${trimmed}".`);
    }

    const minDate = Date.UTC(1990, 0, 1);
    const maxDate = Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate());
    const timestamp = parsed.getTime();
    if (timestamp < minDate) throw new Error(`Date "${trimmed}" is before 1990.`);
    if (timestamp > maxDate) throw new Error(`Date "${trimmed}" is more than one year in the future.`);

    return formatIsoDate(year, month, day);
}

function requireField(record, field, errors) {
    const value = String(record.values[field] ?? '').trim();
    if (!value) errors.push(`Row ${record.rowNumber}: ${field} is required.`);
    return value;
}

export function normalizeBlogRecords(records, { today = new Date() } = {}) {
    const entries = [];
    const errors = [];
    const seenSlugs = new Map();

    for (const record of records) {
        if (!isPublished(record.values.published)) continue;

        const title = requireField(record, 'title', errors);
        const description = requireField(record, 'description', errors);
        const rawDate = requireField(record, 'date', errors);
        const rawDocId = requireField(record, 'google_doc_id', errors);
        const rawSlug = String(record.values.slug ?? '').trim();
        const slug = rawSlug || slugifyTitle(title);
        const docId = extractGoogleDocId(rawDocId);
        let date = '';

        if (rawDate) {
            try {
                date = normalizeDate(rawDate, { today });
            } catch (error) {
                errors.push(`Row ${record.rowNumber}: ${error.message}`);
            }
        }

        if (!slug) errors.push(`Row ${record.rowNumber}: slug could not be derived.`);
        else if (!SLUG_PATTERN.test(slug)) {
            errors.push(`Row ${record.rowNumber}: slug "${slug}" must be lowercase letters, numbers, and hyphens.`);
        } else if (seenSlugs.has(slug)) {
            errors.push(`Row ${record.rowNumber}: duplicate slug "${slug}" also appears on row ${seenSlugs.get(slug)}.`);
        } else {
            seenSlugs.set(slug, record.rowNumber);
        }

        if (!docId) {
            errors.push(`Row ${record.rowNumber}: google_doc_id must be a Google Doc ID or document URL.`);
        }

        entries.push({
            post: {
                slug,
                title,
                date,
                description,
                tags: normalizeTags(record.values.tags),
            },
            docId,
            rowNumber: record.rowNumber,
        });
    }

    if (errors.length > 0) {
        throw new Error(`Blog sheet validation failed:\n${errors.join('\n')}`);
    }

    return entries;
}

function summarizeRecord(record) {
    const title = String(record.values.title ?? '').trim() || '(untitled)';
    const rawSlug = String(record.values.slug ?? '').trim();
    const derivedSlug = rawSlug || slugifyTitle(title) || '(no slug)';
    const published = String(record.values.published ?? '').trim();

    return {
        rowNumber: record.rowNumber,
        slug: derivedSlug,
        title,
        published,
    };
}

function skippedRecordSummary(record) {
    const summary = summarizeRecord(record);
    return {
        ...summary,
        reason: summary.published
            ? `published is "${summary.published}"`
            : 'published is blank',
    };
}

function publishedEntrySummary(entry) {
    return {
        rowNumber: entry.rowNumber,
        slug: entry.post.slug,
        title: entry.post.title,
        date: entry.post.date,
        docId: entry.docId,
    };
}

export function parseBlogSheet(csv, options = {}) {
    return normalizeBlogRecords(parseRecords(parseCsv(csv)), options);
}

export function parseBlogSheetWithSummary(csv, options = {}) {
    const records = parseRecords(parseCsv(csv));
    const entries = normalizeBlogRecords(records, options);
    const skippedRows = records
        .filter((record) => !isPublished(record.values.published))
        .map(skippedRecordSummary);

    return {
        records,
        entries,
        skippedRows,
    };
}

export async function fetchSheetAsCsv(sheetId, sheetName = DEFAULT_BLOG_SHEET_NAME, { fetchImpl = fetch } = {}) {
    const response = await fetchImpl(buildSheetCsvUrl(sheetId, sheetName));
    if (!response.ok) {
        throw new Error(`Failed to fetch blog sheet: ${response.status} ${response.statusText}`);
    }

    const csv = await response.text();
    if (!csv || csv.includes('<!DOCTYPE html>')) {
        throw new Error('Received HTML instead of CSV. Make sure the blog sheet is shared with viewer access.');
    }

    return csv;
}

export async function fetchGoogleDocHtml(docId, { fetchImpl = fetch } = {}) {
    const response = await fetchImpl(buildGoogleDocHtmlUrl(docId));
    if (!response.ok) {
        throw new Error(`Failed to fetch Google Doc ${docId}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    if (!html || !html.includes('<')) {
        throw new Error(`Google Doc ${docId} did not return HTML.`);
    }
    if (/ServiceLogin|Sign in - Google Accounts/i.test(html)) {
        throw new Error(`Google Doc ${docId} requires authentication. Share it with viewer access or add private-doc auth support.`);
    }

    return html;
}

function replaceElementTag(element, tagName) {
    const replacement = element.ownerDocument.createElement(tagName);
    replacement.innerHTML = element.innerHTML;
    element.replaceWith(replacement);
}

function normalizeGoogleDocsTitleParagraphs(document) {
    document.querySelectorAll('p.title').forEach((paragraph) => {
        replaceElementTag(paragraph, 'h1');
    });

    document.querySelectorAll('p.subtitle').forEach((paragraph) => {
        replaceElementTag(paragraph, 'h2');
    });
}

function normalizedTextContent(node) {
    return String(node.textContent ?? '').replace(/\u00a0/g, ' ');
}

function parseCssDeclarations(styleText) {
    const declarations = {};

    for (const declaration of String(styleText ?? '').split(';')) {
        const separatorIndex = declaration.indexOf(':');
        if (separatorIndex === -1) continue;

        const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
        const value = declaration.slice(separatorIndex + 1).trim();
        if (property && value) declarations[property] = value;
    }

    return declarations;
}

function parseGoogleDocsClassStyles(document) {
    const classStyles = new Map();

    document.querySelectorAll('style').forEach((styleElement) => {
        const css = String(styleElement.textContent ?? '');
        const classRulePattern = /\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g;
        let match = classRulePattern.exec(css);

        while (match) {
            classStyles.set(match[1], {
                ...(classStyles.get(match[1]) ?? {}),
                ...parseCssDeclarations(match[2]),
            });
            match = classRulePattern.exec(css);
        }
    });

    return classStyles;
}

function elementStyleDeclarations(element, classStyles) {
    const declarations = {};

    for (const className of element.classList) {
        Object.assign(declarations, classStyles.get(className) ?? {});
    }

    Object.assign(declarations, parseCssDeclarations(element.getAttribute('style')));
    return declarations;
}

function isBoldStyle(value) {
    const weight = String(value ?? '').trim().toLowerCase();
    if (weight === 'bold' || weight === 'bolder') return true;

    const numericWeight = Number.parseInt(weight, 10);
    return Number.isFinite(numericWeight) && numericWeight >= 600;
}

function isMeaningfulBackground(value) {
    const background = String(value ?? '').trim().toLowerCase();
    if (!background || background === 'transparent' || background === 'inherit' || background === 'initial') return false;
    if (background === '#fff' || background === '#ffffff' || background === 'white') return false;
    if (/^rgba\([^)]*,\s*0\)$/.test(background)) return false;
    return true;
}

function wrapElementContents(element, tagName) {
    const wrapper = element.ownerDocument.createElement(tagName);
    while (element.firstChild) wrapper.append(element.firstChild);
    element.append(wrapper);
}

function applySemanticStyles(element, declarations) {
    const wrappers = [];
    const textDecoration = String(declarations['text-decoration'] ?? declarations['text-decoration-line'] ?? '').toLowerCase();

    if (isBoldStyle(declarations['font-weight'])) wrappers.push('strong');
    if (String(declarations['font-style'] ?? '').toLowerCase() === 'italic') wrappers.push('em');
    if (textDecoration.includes('underline')) wrappers.push('u');
    if (textDecoration.includes('line-through')) wrappers.push('del');
    if (isMeaningfulBackground(declarations['background-color'])) wrappers.push('mark');

    for (const tagName of wrappers) {
        wrapElementContents(element, tagName);
    }
}

function canApplySemanticStyles(element) {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'span' || tagName === 'a') return true;

    if (/^h[1-6]$/.test(tagName) || tagName === 'p') {
        return !element.querySelector('blockquote, div, h1, h2, h3, h4, h5, h6, ol, p, pre, table, ul');
    }

    if (tagName === 'li') {
        return !element.querySelector('blockquote, div, h1, h2, h3, h4, h5, h6, li, ol, p, pre, table, ul');
    }

    return false;
}

function normalizeGoogleDocsInlineStyles(document) {
    const classStyles = parseGoogleDocsClassStyles(document);
    if (classStyles.size === 0 && document.querySelectorAll('[style]').length === 0) return;

    document.querySelectorAll('[class], [style]').forEach((element) => {
        if (!canApplySemanticStyles(element)) return;
        if (element.closest('pre, code')) return;
        applySemanticStyles(element, elementStyleDeclarations(element, classStyles));
    });
}

function normalizeGoogleRedirectHref(value) {
    const href = String(value ?? '').trim();
    if (!href) return '';

    try {
        const url = new URL(href);
        const isGoogleRedirect = /(^|\.)google\.com$/i.test(url.hostname) && url.pathname === '/url';
        const target = isGoogleRedirect ? url.searchParams.get('q') : null;
        return target || href;
    } catch {
        return href;
    }
}

function safeUrl(value, { allowedProtocols = SAFE_LINK_PROTOCOLS } = {}) {
    const rawUrl = String(value ?? '').trim();
    if (!rawUrl) return '';

    if (/^(#|\/(?!\/)|\.{1,2}\/)/.test(rawUrl)) return rawUrl;

    try {
        const url = new URL(rawUrl);
        return allowedProtocols.has(url.protocol) ? rawUrl : '';
    } catch {
        return '';
    }
}

function normalizeGoogleDocsLinks(document) {
    document.querySelectorAll('a[href]').forEach((link) => {
        const href = safeUrl(normalizeGoogleRedirectHref(link.getAttribute('href')));
        if (href) link.setAttribute('href', href);
        else link.removeAttribute('href');
    });
}

function normalizeGoogleDocsMedia(document) {
    document.querySelectorAll('img[src]').forEach((image) => {
        const src = safeUrl(image.getAttribute('src'), { allowedProtocols: SAFE_MEDIA_PROTOCOLS });
        if (src) image.setAttribute('src', src);
        else image.removeAttribute('src');
    });
}

function normalizeCodeLanguage(value) {
    const language = String(value ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_+-]+$/.test(language)) return '';
    return LANGUAGE_ALIASES.get(language) ?? language;
}

function inferCodeLanguage(code) {
    const trimmed = String(code ?? '').trim();
    if (!trimmed) return 'text';

    try {
        JSON.parse(trimmed);
        return 'json';
    } catch {
        // Keep checking other lightweight language hints.
    }

    if (/^<\/?[a-z][\s\S]*>/i.test(trimmed)) return 'html';
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(trimmed)) return 'sql';
    if (/^\s*(npm|node|git|curl|aws|cd|mkdir|rm|cp|mv)\b/im.test(trimmed)) return 'bash';
    if (/^\s*(from\s+\w+\s+import|import\s+\w+|def\s+\w+|class\s+\w+\(|print\()/m.test(trimmed)) return 'py';
    if (/^\s*(interface|type)\s+\w+|:\s*(string|number|boolean)\b|as\s+const\b/m.test(trimmed)) return 'ts';
    if (/^\s*(import|export)\s|^\s*(const|let|var|function|class)\s|=>|console\.|new\s+(Map|Set|Date)|\/\^/m.test(trimmed)) return 'js';

    return 'text';
}

function isCodeLineElement(element) {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'p') return true;
    if (tagName === 'li') return !element.querySelector('p, li');
    if (tagName !== 'div') return false;

    return !element.querySelector('blockquote, div, h1, h2, h3, h4, h5, h6, ol, p, pre, table, ul');
}

function normalizeGoogleDocsCodeBlocks(document) {
    const parents = [document.body, ...document.body.querySelectorAll('div, td, th, li')];

    for (const parent of parents) {
        let child = parent.firstElementChild;

        while (child) {
            const text = normalizedTextContent(child);
            if (!isCodeLineElement(child) || !text.includes(GOOGLE_DOCS_CODE_BLOCK_START)) {
                child = child.nextElementSibling;
                continue;
            }

            const pre = document.createElement('pre');
            const code = document.createElement('code');
            const lines = [];
            parent.insertBefore(pre, child);

            let current = child;
            while (current && isCodeLineElement(current)) {
                const next = current.nextElementSibling;
                const lineText = normalizedTextContent(current);
                const isEnd = lineText.includes(GOOGLE_DOCS_CODE_BLOCK_END);
                const normalizedLine = lineText
                    .replaceAll(GOOGLE_DOCS_CODE_BLOCK_START, '')
                    .replaceAll(GOOGLE_DOCS_CODE_BLOCK_END, '')
                    .trimEnd();

                lines.push(normalizedLine);
                current.remove();

                if (isEnd) break;
                current = next;
            }

            while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

            const codeText = lines.join('\n');
            const language = inferCodeLanguage(codeText);
            if (language && language !== 'text') code.className = `language-${language}`;
            code.textContent = codeText;
            pre.append(code);
            child = pre.nextElementSibling;
        }
    }
}

function normalizeGoogleDocsHtml(document) {
    normalizeGoogleDocsTitleParagraphs(document);
    normalizeGoogleDocsInlineStyles(document);
    normalizeGoogleDocsLinks(document);
    normalizeGoogleDocsMedia(document);
    normalizeGoogleDocsCodeBlocks(document);
}

function documentBodyHtml(html) {
    const dom = new JSDOM(html);
    try {
        const document = dom.window.document;
        normalizeGoogleDocsHtml(document);
        document.querySelectorAll(`script, style, meta, title, link, ${UNSUPPORTED_GOOGLE_DOCS_ELEMENTS}`)
            .forEach((node) => node.remove());
        return document.body?.innerHTML ?? html;
    } finally {
        dom.window.close();
    }
}

function escapedHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/{/g, '&#123;')
        .replace(/}/g, '&#125;')
        .replace(/"/g, '&quot;');
}

function tableCellHasContent(cell) {
    return normalizedTextContent(cell).trim() !== '' || Boolean(cell.querySelector('br, img[src], pre'));
}

function tableCellBlocks(cell) {
    const blockSelector = 'div, li, p, pre';
    const blocks = Array.from(cell.children).filter((child) => child.matches(blockSelector));
    return blocks.length > 0 ? blocks : [cell];
}

function serializedChildren(node) {
    return Array.from(node.childNodes).map(serializeTableCellNode).join('');
}

function serializeCodeTag(node) {
    const className = node.getAttribute('class');
    const attributes = className ? ` className="${escapedHtml(className)}"` : '';
    return `<code${attributes}>${escapedHtml(normalizedTextContent(node))}</code>`;
}

function serializeImageTag(node) {
    const src = safeUrl(node.getAttribute('src'), { allowedProtocols: SAFE_MEDIA_PROTOCOLS });
    if (!src) return '';

    const alt = node.getAttribute('alt');
    const title = node.getAttribute('title');
    const attributes = [
        `src="${escapedHtml(src)}"`,
        alt ? `alt="${escapedHtml(alt)}"` : 'alt=""',
        title ? `title="${escapedHtml(title)}"` : '',
    ].filter(Boolean);
    return `<img ${attributes.join(' ')} />`;
}

function serializeTableCellNode(node) {
    if (node.nodeType === node.TEXT_NODE) {
        return escapedHtml(String(node.textContent ?? '').replace(/\u00a0/g, ' '));
    }

    if (node.nodeType !== node.ELEMENT_NODE) return '';

    const element = node;
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'br') return '<br />';
    if (tagName === 'span') return serializedChildren(element);
    if (tagName === 'strong' || tagName === 'b') return `<strong>${serializedChildren(element)}</strong>`;
    if (tagName === 'em' || tagName === 'i') return `<em>${serializedChildren(element)}</em>`;
    if (tagName === 'mark') return `<mark>${serializedChildren(element)}</mark>`;
    if (tagName === 'u') return `<u>${serializedChildren(element)}</u>`;
    if (tagName === 'code') return serializeCodeTag(element);
    if (tagName === 'img') return serializeImageTag(element);
    if (tagName === 's' || tagName === 'del') return `<del>${serializedChildren(element)}</del>`;
    if (tagName === 'sub' || tagName === 'sup') return `<${tagName}>${serializedChildren(element)}</${tagName}>`;
    if (tagName === 'pre') return `<pre>${serializedChildren(element)}</pre>`;

    if (tagName === 'a') {
        const href = safeUrl(normalizeGoogleRedirectHref(element.getAttribute('href')));
        const title = element.getAttribute('title');
        const attributes = [
            href ? `href="${escapedHtml(href)}"` : '',
            title ? `title="${escapedHtml(title)}"` : '',
        ].filter(Boolean);
        const attributeText = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
        return `<a${attributeText}>${serializedChildren(element)}</a>`;
    }

    return serializedChildren(element);
}

function serializeTableCellBlock(block) {
    return block.tagName.toLowerCase() === 'pre'
        ? serializeTableCellNode(block).trim()
        : serializedChildren(block).trim();
}

function tableCellHtml(cell) {
    return tableCellBlocks(cell)
        .map(serializeTableCellBlock)
        .filter(Boolean)
        .join('<br />');
}

function tableToHtml(node) {
    const rows = Array.from(node.querySelectorAll('tr'))
        .map((row) => Array.from(row.querySelectorAll('th, td')))
        .filter((cells) => cells.some(tableCellHasContent));
    if (rows.length === 0) return '';

    const htmlRows = rows.map((cells) => {
        const htmlCells = cells.map((cell) => {
            const tagName = cell.tagName.toLowerCase() === 'th' ? 'th' : 'td';
            const colspan = Number(cell.getAttribute('colspan') ?? '1');
            const rowspan = Number(cell.getAttribute('rowspan') ?? '1');
            const attributes = ['className="blog-table-cell"'];
            if (Number.isInteger(colspan) && colspan > 1) attributes.push(`colSpan={${colspan}}`);
            if (Number.isInteger(rowspan) && rowspan > 1) attributes.push(`rowSpan={${rowspan}}`);
            return `<${tagName} ${attributes.join(' ')}>${tableCellHtml(cell)}</${tagName}>`;
        }).join('');
        return `<tr>${htmlCells}</tr>`;
    }).join('\n');

    return `\n\n<div className="blog-table-scroll">\n<table className="blog-table">\n<tbody>\n${htmlRows}\n</tbody>\n</table>\n</div>\n\n`;
}

function normalizeTypedCodeFences(markdown) {
    const fenceMatches = markdown.match(ESCAPED_CODE_FENCE_PATTERN) ?? [];
    if (fenceMatches.length === 0) return trimCodeFencePadding(markdown);
    if (fenceMatches.length % 2 === 0) {
        return trimCodeFencePadding(markdown.replace(
            ESCAPED_CODE_FENCE_PATTERN,
            (_match, language) => `\`\`\`${normalizeCodeLanguage(language) || language}`
        ));
    }

    return trimCodeFencePadding(markdown.replace(ESCAPED_CODE_FENCE_PATTERN, '').replace(/\n{3,}/g, '\n\n'));
}

function trimCodeFencePadding(markdown) {
    return String(markdown).replace(/```([^\n]*)\n([\s\S]*?)\n```/g, (_match, language, body) => {
        const trimmedBody = String(body).replace(/^\n+/, '').replace(/\n+$/, '');
        return `\`\`\`${language}\n${trimmedBody}\n\`\`\``;
    });
}

function createTurndownService() {
    const service = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
    });

    service.addRule('lineBreak', {
        filter: 'br',
        replacement: () => '\n',
    });

    service.addRule('table', {
        filter: 'table',
        replacement: (_content, node) => tableToHtml(node),
    });

    service.addRule('mark', {
        filter: 'mark',
        replacement: (_content, node) => {
            const html = serializedChildren(node).trim();
            return html ? `<mark>${html}</mark>` : '';
        },
    });

    service.addRule('underline', {
        filter: 'u',
        replacement: (_content, node) => {
            const html = serializedChildren(node).trim();
            return html ? `<u>${html}</u>` : '';
        },
    });

    return service;
}

export function convertHtmlToMarkdown(html, { turndownService = createTurndownService() } = {}) {
    const markdown = normalizeTypedCodeFences(turndownService
        .turndown(documentBodyHtml(html))
        .replace(/\u00a0/g, ' ')
        .replace(/^([*-]) {3}/gm, '$1 ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim());

    if (!markdown) {
        throw new Error('Converted Google Doc content was empty.');
    }

    return markdown;
}

export function buildMdx(post, markdown) {
    return [
        '---',
        `title: ${JSON.stringify(post.title)}`,
        `date: ${JSON.stringify(post.date)}`,
        `description: ${JSON.stringify(post.description)}`,
        `tags: ${JSON.stringify(post.tags)}`,
        '---',
        '',
        markdown.trim(),
        '',
    ].join('\n');
}

function sortPosts(posts) {
    return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function mergePostMetadata(existingPosts, syncedPosts, { replaceAll = false } = {}) {
    if (replaceAll) return sortPosts(syncedPosts);

    const syncedSlugs = new Set(syncedPosts.map((post) => post.slug));
    const retainedPosts = existingPosts.filter((post) => !syncedSlugs.has(post.slug));
    return sortPosts([...retainedPosts, ...syncedPosts]);
}

function readExistingPosts(postsPath, fsImpl) {
    if (!fsImpl.existsSync(postsPath)) return [];
    return JSON.parse(fsImpl.readFileSync(postsPath, 'utf-8'));
}

export function writeIfChanged(filePath, content, { fsImpl = fs } = {}) {
    let existing = null;
    try {
        existing = fsImpl.readFileSync(filePath, 'utf-8');
    } catch {
        existing = null;
    }

    if (existing === content) return false;

    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
    fsImpl.writeFileSync(filePath, content, 'utf-8');
    return true;
}

export function envFlag(value, defaultValue = false) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return defaultValue;
    if (/^(0|false|no|off)$/i.test(normalized)) return false;
    return TRUE_VALUES.has(normalized);
}

function removeStaleGeneratedBlogFiles(blogDir, syncedSlugs, { fsImpl = fs } = {}) {
    let entries = [];
    try {
        entries = fsImpl.readdirSync(blogDir, { withFileTypes: true });
    } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
    }

    const expectedFiles = new Set([...syncedSlugs].map((slug) => `${slug}.mdx`));
    const removedFiles = [];

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.mdx') || expectedFiles.has(entry.name)) {
            continue;
        }

        const filePath = path.join(blogDir, entry.name);
        fsImpl.rmSync(filePath);
        removedFiles.push(filePath);
    }

    return removedFiles;
}

export function writeGithubOutput(outputPath, changed, { fsImpl = fs } = {}) {
    if (!outputPath) return;
    fsImpl.writeFileSync(outputPath, `changed=${changed ? 'true' : 'false'}\n`, { flag: 'a' });
}

export async function syncBlogPosts({
    sheetId = process.env.GOOGLE_BLOG_SHEET_ID,
    sheetName = process.env.GOOGLE_BLOG_SHEET_NAME || DEFAULT_BLOG_SHEET_NAME,
    repoRoot = REPO_ROOT,
    postsPath = path.join(repoRoot, 'src/content/posts.json'),
    blogDir = path.join(repoRoot, 'src/content/blog'),
    replaceAll = envFlag(process.env.GOOGLE_BLOG_REPLACE_ALL, true),
    today = new Date(),
    fetchImpl = fetch,
    fsImpl = fs,
} = {}) {
    if (!sheetId) {
        throw new Error('GOOGLE_BLOG_SHEET_ID environment variable is required.');
    }

    const csv = await fetchSheetAsCsv(sheetId, sheetName, { fetchImpl });
    const { records, entries, skippedRows } = parseBlogSheetWithSummary(csv, { today });
    const mdxFiles = [];

    for (const entry of entries) {
        const html = await fetchGoogleDocHtml(entry.docId, { fetchImpl });
        const markdown = convertHtmlToMarkdown(html);
        mdxFiles.push({
            path: path.join(blogDir, `${entry.post.slug}.mdx`),
            content: buildMdx(entry.post, markdown),
        });
    }

    const existingPosts = readExistingPosts(postsPath, fsImpl);
    const posts = mergePostMetadata(existingPosts, entries.map((entry) => entry.post), { replaceAll });
    const postsJson = `${JSON.stringify(posts, null, 4)}\n`;
    const changedFiles = [];

    if (replaceAll) {
        changedFiles.push(...removeStaleGeneratedBlogFiles(
            blogDir,
            entries.map((entry) => entry.post.slug),
            { fsImpl }
        ));
    }

    if (writeIfChanged(postsPath, postsJson, { fsImpl })) changedFiles.push(postsPath);
    for (const mdxFile of mdxFiles) {
        if (writeIfChanged(mdxFile.path, mdxFile.content, { fsImpl })) changedFiles.push(mdxFile.path);
    }

    return {
        changed: changedFiles.length > 0,
        changedFiles,
        changedFileLabels: changedFiles.map((filePath) => path.relative(repoRoot, filePath)),
        fetchedRows: records.length,
        publishedRows: entries.map(publishedEntrySummary),
        skippedRows,
        syncedPosts: entries.length,
        totalPosts: posts.length,
        sheetName,
    };
}

function printSyncSummary(result) {
    console.log(
        `Sheet "${result.sheetName}": ${result.fetchedRows} data row(s), `
        + `${result.syncedPosts} published, ${result.skippedRows.length} skipped.`
    );

    if (result.publishedRows.length > 0) {
        console.log('Published rows:');
        for (const row of result.publishedRows) {
            console.log(`  Row ${row.rowNumber}: ${row.slug} - ${row.title} (${row.date})`);
        }
    }

    if (result.skippedRows.length > 0) {
        console.log('Skipped rows:');
        for (const row of result.skippedRows) {
            console.log(`  Row ${row.rowNumber}: ${row.slug} - ${row.title} (${row.reason})`);
        }
    }

    if (result.changed) {
        console.log(`Changed files (${result.changedFileLabels.length}):`);
        for (const filePath of result.changedFileLabels) {
            console.log(`  ${filePath}`);
        }
    } else {
        console.log('Changed files: none');
    }

    console.log(`posts.json now contains ${result.totalPosts} post(s).`);
}

async function main() {
    try {
        loadLocalEnvFiles();
        const result = await syncBlogPosts();
        printSyncSummary(result);
        writeGithubOutput(process.env.GITHUB_OUTPUT, result.changed);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) main();
