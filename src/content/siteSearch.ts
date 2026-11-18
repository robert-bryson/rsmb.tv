import { normalizeSearch } from '../utils/search';

const EXCERPT_LENGTH = 190;
const EXCERPT_LEADING_CONTEXT = 55;
const STATUS_PASSAGE = /\b(?:failed|unable|couldn['’]t) to (?:load|fetch)|^(?:loading\b|try again\b|no (?:results|matches)\b)/i;

export interface SiteSearchDocument {
    url: string;
    title: string;
    description: string;
    content: string;
    keywords?: string;
    kind: 'Page' | 'Project' | 'Map' | 'Post' | 'Trip report';
    draft?: boolean;
}

export interface SiteSearchResult extends SiteSearchDocument {
    excerpt: string;
}

export function searchSite(documents: SiteSearchDocument[], query: string): SiteSearchResult[] {
    const phrase = normalizeSearch(query);
    const terms = [...new Set(phrase.split(' ').filter(Boolean))];
    if (!terms.length) return [];

    return documents.flatMap(document => {
        const title = normalizeSearch(document.title);
        const description = normalizeSearch(document.description);
        const keywords = normalizeSearch(document.keywords ?? '');
        const content = normalizeSearch(document.content);
        const text = `${title} ${description} ${keywords} ${content}`;
        if (!terms.every(term => text.includes(term))) return [];

        const score = (title === phrase ? 100 : title.startsWith(phrase) ? 50 : title.includes(phrase) ? 30 : 0)
            + terms.reduce((total, term) => total + (title.includes(term) ? 12 : description.includes(term) ? 5 : keywords.includes(term) ? 3 : 1), 0);
        return [{ ...document, excerpt: searchExcerpt(document, terms), score }];
    }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function searchExcerpt(document: SiteSearchDocument, terms: string[]): string {
    const metadata = normalizeSearch(`${document.title} ${document.description} ${document.keywords ?? ''}`);
    if (document.description && terms.every(term => metadata.includes(term))) return document.description;

    // Page extraction keeps paragraph boundaries. Prefer a complete relevant
    // passage over a slice joining controls, loading states, and change notes.
    const bodyTerms = terms.filter(term => !metadata.includes(term));
    const isArticle = document.kind === 'Post' || document.kind === 'Trip report';
    let selected: { passage: string; matches: number } | undefined;
    for (const block of document.content.split(/\n+/)) {
        const passage = block.trim();
        if (!passage || (!isArticle && STATUS_PASSAGE.test(passage))) continue;
        const normalized = normalizeSearch(passage);
        if (!bodyTerms.every(term => normalized.includes(term))) continue;
        const matches = terms.filter(term => normalized.includes(term)).length;
        if (matches && (!selected || matches > selected.matches)) selected = { passage, matches };
    }
    if (!selected) return document.description;
    if (selected.passage.length <= EXCERPT_LENGTH) return selected.passage;

    const passage = selected.passage;
    const excerptTerms = bodyTerms.length ? bodyTerms : terms;
    let best: { start: number; end: number; matches: number } | undefined;
    for (const word of passage.matchAll(/\S+/gu)) {
        if (!excerptTerms.some(term => normalizeSearch(word[0]).includes(term))) continue;
        let start = Math.max(0, word.index - EXCERPT_LEADING_CONTEXT);
        if (start) start = passage.indexOf(' ', start) + 1;
        let end = Math.min(passage.length, start + EXCERPT_LENGTH);
        if (end < passage.length) {
            const space = passage.lastIndexOf(' ', end);
            if (space > start) end = space;
        }
        const preview = normalizeSearch(passage.slice(start, end));
        const matches = terms.filter(term => preview.includes(term)).length;
        if (!best || matches > best.matches) best = { start, end, matches };
        if (matches === terms.length) break;
    }
    if (!best) return document.description;
    const { start, end } = best;
    return `${start ? '…' : ''}${passage.slice(start, end).trim()}${end < passage.length ? '…' : ''}`;
}
