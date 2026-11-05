import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const { customHeaders } = parse(readFileSync(new URL('../customHttp.yml', import.meta.url), 'utf8'));

// Amplify applies custom headers to each matching file path:
// https://docs.aws.amazon.com/amplify/latest/userguide/custom-header-YAML-format.html
function matchesPattern(pattern, pathname) {
    let expression = '';
    for (let index = 0; index < pattern.length; index++) {
        if (pattern.slice(index, index + 3) === '**/') {
            expression += '(?:.*/)?';
            index += 2;
        } else if (pattern.slice(index, index + 2) === '**') {
            expression += '.*';
            index++;
        } else if (pattern[index] === '*') expression += '[^/]*';
        else expression += pattern[index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const candidate = !pattern.includes('/') ? path.posix.basename(pathname)
        : pattern.startsWith('/') ? pathname : pathname.slice(1);
    return new RegExp(`^${expression}$`).test(candidate);
}

/** Lower-case field names with their configured values for fixture HTTP servers. */
export function expectedHostingHeaders(urlOrPath) {
    const pathname = new URL(urlOrPath, 'https://hosting.invalid').pathname;
    const expected = {};
    for (const { pattern, headers } of customHeaders) {
        if (!matchesPattern(pattern, pathname)) continue;
        for (const { key, value } of headers) expected[key.trim().toLowerCase()] = value;
    }
    return expected;
}

function splitOutsideQuotes(value, delimiter) {
    const parts = [];
    let quoted = false;
    let escaped = false;
    let start = 0;
    for (let index = 0; index < value.length; index++) {
        const character = value[index];
        if (escaped) { escaped = false; continue; }
        if (quoted && character === '\\') { escaped = true; continue; }
        if (character === '"') quoted = !quoted;
        else if (!quoted && character === delimiter) { parts.push(value.slice(start, index).trim()); start = index + 1; }
    }
    parts.push(value.slice(start).trim());
    return parts.filter(Boolean);
}

function normalizeParameter(parameter, charset = false) {
    const separator = parameter.indexOf('=');
    if (separator < 0) return parameter.trim().toLowerCase();
    const name = parameter.slice(0, separator).trim().toLowerCase();
    let value = parameter.slice(separator + 1).trim();
    if (/^"[^"\\]*"$/.test(value)) value = value.slice(1, -1);
    if ((name === 'max-age' || name === 's-maxage') && /^\d+$/.test(value)) value = BigInt(value).toString();
    if (charset && name === 'charset') value = value.toLowerCase();
    return `${name}=${value}`;
}

function normalizeCspSource(source) {
    // Keyword/scheme/host matching ignores case; nonces, hashes, and paths do not.
    if (/^'(?:self|none|unsafe-inline|unsafe-eval|strict-dynamic|unsafe-hashes|report-sample|wasm-unsafe-eval)'$/i.test(source)
        || /^[a-z][\w+.-]*:$/i.test(source)) return source.toLowerCase();
    if (source.startsWith("'")) return source;
    const host = source.match(/^([a-z][\w+.-]*:\/\/)?([^/]+)(\/.*)?$/i);
    return host ? `${(host[1] ?? '').toLowerCase()}${host[2].toLowerCase()}${host[3] ?? ''}` : source;
}

function normalizeHeader(name, value) {
    if (name === 'cache-control' || name === 'strict-transport-security') {
        const delimiter = name === 'cache-control' ? ',' : ';';
        return JSON.stringify(splitOutsideQuotes(value, delimiter).map(part => normalizeParameter(part)).sort());
    }
    if (name === 'content-type') {
        const [type, ...parameters] = splitOutsideQuotes(value, ';');
        return JSON.stringify([(type ?? '').toLowerCase(), parameters.map(parameter => normalizeParameter(parameter, true)).sort()]);
    }
    if (name === 'content-security-policy') {
        return JSON.stringify(value.split(';').map(directive => directive.trim()).filter(Boolean).map(directive => {
            const [key, ...sources] = directive.split(/\s+/);
            return [key.toLowerCase(), sources.map(normalizeCspSource).sort()];
        }).sort(([left], [right]) => left.localeCompare(right)));
    }
    if (name === 'permissions-policy') {
        return JSON.stringify(splitOutsideQuotes(value, ',').map(part => normalizeParameter(part)
            .replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s+/g, ' ')).sort());
    }
    if (['x-content-type-options', 'x-frame-options', 'referrer-policy'].includes(name)) return value.trim().toLowerCase();
    return value.trim();
}

/** Assert the repository's configured response policy for a first-party URL. */
export function assertHostingHeaders(urlOrPath, actualHeaders) {
    const expected = expectedHostingHeaders(urlOrPath);
    const actual = Object.create(null);
    for (const [key, value] of Object.entries(actualHeaders)) {
        const name = key.trim().toLowerCase();
        if (actual[name] !== undefined) throw new Error(`Duplicate hosting header ${name} for ${urlOrPath}.`);
        actual[name] = value;
    }
    for (const [name, value] of Object.entries(expected)) {
        if (typeof actual[name] !== 'string' || !actual[name].trim()) throw new Error(`Missing hosting header ${name} for ${urlOrPath}.`);
        if (normalizeHeader(name, actual[name]) !== normalizeHeader(name, value)) {
            throw new Error(`Hosting header ${name} mismatch for ${urlOrPath}: expected ${JSON.stringify(value)}, received ${JSON.stringify(actual[name])}.`);
        }
    }
}
