import { normalizeSearch } from '../utils/search';

const blocks = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,td,th,pre,blockquote,summary';
const excluded = 'nav,form,button,input,select,textarea,svg,canvas,script,style,template,[hidden],[inert],[aria-hidden="true"],.sr-only';

/** Search text belongs to this history entry, not its URL or analytics. */
export function getSiteSearchQuery(state: unknown): string {
    if (!state || typeof state !== 'object' || !('siteSearchQuery' in state) || typeof state.siteSearchQuery !== 'string') return '';
    return normalizeSearch(state.siteSearchQuery);
}

/** Editing a page starts a new view; keep caller context and drop the previous landing request. */
export function withoutSiteSearchQuery(state: unknown): unknown {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
    const next: Record<string, unknown> = { ...state };
    delete next.siteSearchQuery;
    return next;
}

interface Passage {
    element: HTMLElement;
    nodes: Text[];
    text: string;
}

/** Map normalized characters back to UTF-16 offsets without changing React's text nodes. */
function normalizedOffsets(text: string) {
    const starts: number[] = [];
    const ends: number[] = [];
    let offset = 0;
    let separator = true;
    for (const character of text) {
        const folded = character.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
        if (!folded && ends.length) ends[ends.length - 1] = offset + character.length;
        for (const part of folded) {
            if (/[\p{L}\p{N}]/u.test(part)) {
                for (let unit = 0; unit < part.length; unit++) {
                    starts.push(offset);
                    ends.push(offset + character.length);
                }
                separator = false;
            } else if (!separator) {
                starts.push(offset);
                ends.push(offset + character.length);
                separator = true;
            }
        }
        offset += character.length;
    }
    return { starts, ends };
}

function textPoint(nodes: Text[], offset: number): [Text, number] {
    for (const node of nodes) {
        if (offset <= node.length) return [node, offset];
        offset -= node.length;
    }
    const last = nodes[nodes.length - 1];
    return [last, last.length];
}

/** Prefer a visible phrase, then a passage with all words, then the first matching word. */
export function findSiteSearchMatch(root: HTMLElement, query: string): { element: HTMLElement; range: Range } | undefined {
    const phrase = normalizeSearch(query);
    if (!phrase) return;
    const terms = [...new Set(phrase.split(' '))];
    const passages = new Map<HTMLElement, Passage>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const parent = node.parentElement;
        if (!node.data || !parent || parent.closest(excluded) || !parent.getClientRects().length
            || getComputedStyle(parent).visibility !== 'visible') continue;
        const element = parent.closest<HTMLElement>(blocks) ?? parent.closest<HTMLElement>('div,section,article,main,[role="main"]') ?? parent;
        const passage = passages.get(element) ?? { element, nodes: [], text: '' };
        passage.nodes.push(node);
        passage.text += node.data;
        passages.set(element, passage);
    }
    const candidates = [...passages.values()].map(passage => ({ ...passage, normalized: normalizeSearch(passage.text) }));
    const match = candidates.find(passage => passage.normalized.includes(phrase))
        ?? candidates.find(passage => terms.every(term => passage.normalized.includes(term)))
        ?? candidates.find(passage => terms.some(term => passage.normalized.includes(term)));
    if (!match) return;
    const term = match.normalized.includes(phrase) ? phrase : terms.find(term => match.normalized.includes(term))!;
    const index = match.normalized.indexOf(term);
    const offsets = normalizedOffsets(match.text);
    const range = document.createRange();
    range.setStart(...textPoint(match.nodes, offsets.starts[index]));
    range.setEnd(...textPoint(match.nodes, offsets.ends[index + term.length - 1]));
    return { element: match.element, range };
}
