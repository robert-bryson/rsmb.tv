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
    segments: { node: Text; start: number; end: number }[];
    text: string;
    block?: Element;
}

export interface SiteSearchMatch {
    element: HTMLElement;
    range: Range;
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

function textPoint(segments: Passage['segments'], offset: number): [Text, number] {
    for (const segment of segments) {
        if (offset <= segment.end) return [segment.node, Math.max(0, offset - segment.start)];
    }
    const last = segments[segments.length - 1].node;
    return [last, last.length];
}

/** Prefer a visible phrase, then a passage with all words, then the first matching word. */
export function findSiteSearchMatch(root: HTMLElement, query: string): SiteSearchMatch | undefined {
    const phrase = normalizeSearch(query);
    if (!phrase) return;
    const terms = [...new Set(phrase.split(' '))];
    const passages = new Map<HTMLElement, Passage>();
    const styles = new Map<Element, CSSStyleDeclaration>();
    const painted = new Map<Element, boolean>();
    const styleFor = (element: Element) => {
        let style = styles.get(element);
        if (!style) { style = getComputedStyle(element); styles.set(element, style); }
        return style;
    };
    const canPaint = (element: Element): boolean => {
        const cached = painted.get(element);
        if (cached !== undefined) return cached;
        const style = styleFor(element);
        const visible = style.opacity !== '0' && style.contentVisibility !== 'hidden' && style.display !== 'none'
            && (!element.parentElement || canPaint(element.parentElement));
        painted.set(element, visible);
        return visible;
    };
    const nearestBlock = (parent: Element, passage: HTMLElement) => {
        for (let element: Element | null = parent; element && element !== passage; element = element.parentElement) {
            if (/^(block|flex|grid|list-item|table(?:-.+)?)$/.test(styleFor(element).display)) return element;
        }
    };
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: node => node instanceof Element && (node.matches(excluded) || !canPaint(node))
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const probe = root.ownerDocument.createRange();
    let breakBefore = false;
    let previousPassage: Passage | undefined;
    while (walker.nextNode()) {
        if (walker.currentNode instanceof Element) {
            if (walker.currentNode.tagName === 'BR') breakBefore = true;
            continue;
        }
        const node = walker.currentNode as Text;
        const parent = node.parentElement;
        if (!node.data || !parent || parent.closest(excluded) || !canPaint(parent) || styleFor(parent).visibility !== 'visible') continue;
        probe.selectNodeContents(node);
        if (!Array.from(probe.getClientRects()).some(rect => rect.width > 0 && rect.height > 0)) continue;
        const element = parent.closest<HTMLElement>(blocks) ?? parent.closest<HTMLElement>('div,section,article,main,[role="main"]') ?? parent;
        const passage: Passage = passages.get(element) ?? { element, segments: [], text: '' };
        const block = nearestBlock(parent, element);
        // Layout breaks need offsets of their own, but must not alter authored text nodes.
        if (passage.segments.length && (breakBefore || block !== passage.block || previousPassage !== passage)) passage.text += '\n';
        passage.segments.push({ node, start: passage.text.length, end: passage.text.length + node.length });
        passage.text += node.data;
        passage.block = block;
        passages.set(element, passage);
        previousPassage = passage;
        breakBefore = false;
    }
    const candidates = [...passages.values()].map(passage => ({ ...passage, normalized: normalizeSearch(passage.text) }));
    const match = candidates.find(passage => passage.normalized.includes(phrase))
        ?? candidates.find(passage => terms.every(term => passage.normalized.includes(term)))
        ?? candidates.find(passage => terms.some(term => passage.normalized.includes(term)));
    if (!match) return;
    const term = match.normalized.includes(phrase) ? phrase : terms.find(term => match.normalized.includes(term))!;
    const index = match.normalized.indexOf(term);
    const offsets = normalizedOffsets(match.text);
    const range = root.ownerDocument.createRange();
    range.setStart(...textPoint(match.segments, offsets.starts[index]));
    range.setEnd(...textPoint(match.segments, offsets.ends[index + term.length - 1]));
    return { element: match.element, range };
}
