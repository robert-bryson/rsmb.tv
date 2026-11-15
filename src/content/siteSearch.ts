import { normalizeSearch } from '../utils/search';

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
    if (terms.every(term => normalizeSearch(document.description).includes(term))) return document.description;
    let match: RegExpExecArray | undefined;
    for (const word of document.content.matchAll(/\S+/gu)) {
        if (terms.some(term => normalizeSearch(word[0]).includes(term))) {
            match = word;
            break;
        }
    }
    if (!match) return document.description;

    const text = document.content;
    let start = Math.max(0, match.index - 55);
    if (start) start = text.indexOf(' ', start) + 1;
    let end = Math.min(text.length, start + 190);
    if (end < text.length) {
        const space = text.lastIndexOf(' ', end);
        if (space > start) end = space;
    }
    return `${start ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
