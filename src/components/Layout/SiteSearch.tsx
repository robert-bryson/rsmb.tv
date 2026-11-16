import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntentLink } from '../IntentLink';
import { searchSite, type SiteSearchDocument } from '../../content/siteSearch';
import { loadSiteSearchIndex } from '../../navigation/siteSearchIndex';
import { normalizeSearch } from '../../utils/search';

function Highlight({ text, query }: { text: string; query: string }) {
    const terms = normalizeSearch(query).split(' ').filter(Boolean);
    return text.split(/([\p{L}\p{N}\p{M}]+)/gu).map((part, index) => (
        part.trim() && terms.some(term => normalizeSearch(part).includes(term))
            ? <mark key={index} className="site-search-match font-medium">{part}</mark>
            : part
    ));
}

export function SiteSearch() {
    const id = useId();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [documents, setDocuments] = useState<SiteSearchDocument[]>();
    const [failed, setFailed] = useState(false);
    const pending = useRef(false);
    const composing = useRef(false);
    const container = useRef<HTMLFormElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const links = useRef<(HTMLAnchorElement | null)[]>([]);
    const results = useMemo(() => searchSite(documents ?? [], query), [documents, query]);
    const showResults = open && Boolean(normalizeSearch(query));

    async function loadIndex() {
        if (documents || pending.current) return;
        pending.current = true;
        setFailed(false);
        try {
            setDocuments(await loadSiteSearchIndex());
        } catch {
            setFailed(true);
        } finally {
            pending.current = false;
        }
    }

    useEffect(() => {
        if (!open) return;
        const dismiss = (event: PointerEvent) => {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', dismiss);
        return () => document.removeEventListener('pointerdown', dismiss);
    }, [open]);

    function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) {
            if (event.key === 'Enter') event.preventDefault();
            return;
        }
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            input.current?.focus({ preventScroll: true });
            setOpen(false);
        }
        if (!showResults || !results.length || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
        event.preventDefault();
        const current = links.current.findIndex(link => link === document.activeElement);
        const next = event.key === 'ArrowDown' ? current + 1 : current < 0 ? results.length - 1 : current - 1;
        if (next < 0 || next >= results.length) input.current?.focus({ preventScroll: true });
        else links.current[next]?.focus();
    }

    return <form ref={container} role="search" aria-label="Site search"
        className="relative order-3 w-full min-w-0 pb-1 sm:w-44 sm:pb-0"
        onKeyDown={handleKeyDown}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
        onSubmit={event => {
            event.preventDefault();
            if (composing.current) return;
            setOpen(true);
            if (results[0]) { setOpen(false); setQuery(''); navigate(results[0].url, { state: { siteSearchQuery: query } }); }
        }}
    >
        <label htmlFor={id} className="sr-only">Search site</label>
        <div className="relative flex items-center rounded-md border border-zinc-800/60 bg-zinc-900/30 text-zinc-400 transition-colors focus-within:border-zinc-600 hover:border-zinc-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="pointer-events-none absolute left-2.5 size-4">
                <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" />
            </svg>
            <input ref={input} id={id} type="search" name="q" value={query} autoComplete="off" spellCheck={false}
                placeholder="Search…" aria-describedby={`${id}-hint`} aria-controls={showResults ? `${id}-results` : undefined}
                className="site-search-input h-9 w-full min-w-0 rounded-md bg-transparent pr-8 pl-8 text-sm text-zinc-200 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                onCompositionStart={() => { composing.current = true; }}
                onCompositionEnd={() => { composing.current = false; }}
                onFocus={() => { setOpen(true); void loadIndex(); }}
                onClick={() => { setOpen(true); void loadIndex(); }}
                onChange={event => { setQuery(event.target.value); setOpen(true); void loadIndex(); }}
            />
            {query && <button type="button" aria-label="Clear site search" className="absolute right-0 grid size-9 place-items-center rounded-md hover:text-zinc-100"
                onClick={() => { setQuery(''); input.current?.focus(); }}>
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>}
        </div>
        <span id={`${id}-hint`} className="sr-only">Search posts, article text, projects, and pages. Use the arrow keys to browse results and Escape to close.</span>
        {showResults && <section id={`${id}-results`} aria-label="Search results"
            className="absolute top-full right-0 z-50 mt-2 flex max-h-[calc(100dvh-var(--site-header-height,61px)-1rem)] w-full flex-col overflow-hidden rounded-lg border border-zinc-700/80 bg-[#111111] shadow-xl sm:w-[min(30rem,calc(100vw-3rem))]">
            <p role="status" aria-live="polite" aria-atomic="true" className="shrink-0 border-b border-zinc-800 px-4 py-3 text-xs text-zinc-400">
                {failed ? 'Search is unavailable.' : !documents ? 'Searching…' : `${results.length} ${results.length === 1 ? 'result' : 'results'} across the site`}
            </p>
            {failed ? <div className="px-4 py-4 text-sm text-zinc-400">
                Couldn’t load search. <button type="button" onClick={() => void loadIndex()} className="min-h-9 text-violet-300 hover:underline">Try again</button>
            </div> : documents && (results.length ? <ul aria-label="Search matches" className="max-h-[min(65dvh,32rem)] min-h-0 overflow-y-auto overscroll-contain p-1">
                {results.map((result, index) => <li key={result.url}>
                    <IntentLink to={result.url} state={{ siteSearchQuery: query }} prefetchMode="none" ref={link => { links.current[index] = link; }}
                        className="block rounded-md px-3 py-3 hover:bg-zinc-800/60 focus-visible:bg-zinc-800/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-400"
                        onClick={() => { setOpen(false); setQuery(''); }}>
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="min-w-0 wrap-anywhere text-sm font-medium text-zinc-200"><Highlight text={result.title} query={query} /></span>
                            <span className="shrink-0 text-[11px] text-zinc-400">{result.kind}{result.draft ? ' · Draft' : ''}</span>
                        </div>
                        <p className="line-clamp-2 wrap-anywhere text-xs leading-relaxed text-zinc-400"><Highlight text={result.excerpt} query={query} /></p>
                    </IntentLink>
                </li>)}
            </ul> : <p className="px-4 py-5 text-sm text-zinc-400">No results for “{query.trim()}”. Try another word or phrase.</p>)}
        </section>}
    </form>;
}
