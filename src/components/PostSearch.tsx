import { useId, type RefObject } from 'react';

interface PostSearchProps {
    query: string;
    onChange: (query: string) => void;
    inputRef: RefObject<HTMLInputElement | null>;
}

export function PostSearch({ query, onChange, inputRef }: PostSearchProps) {
    const id = useId();
    const hintId = `${id}-hint`;
    return <form role="search" aria-label="Search posts" onSubmit={event => event.preventDefault()} className="mb-6">
        <label htmlFor={id} className="mb-2 block text-sm font-medium text-zinc-200">Search posts</label>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 focus-within:border-violet-400 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-400">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="ml-3 size-5 shrink-0 text-zinc-400">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4.5 4.5" />
            </svg>
            <input
                ref={inputRef}
                id={id}
                name="q"
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={event => onChange(event.target.value)}
                aria-describedby={hintId}
                placeholder="Try a topic or a place…"
                style={{ outline: 'none' }}
                className="min-h-11 min-w-0 flex-1 bg-transparent px-2 py-2 text-base text-zinc-100 placeholder:text-zinc-400"
            />
            {query && <button
                type="button"
                onClick={() => { onChange(''); inputRef.current?.focus(); }}
                className="mr-1 min-h-11 rounded-md px-3 text-sm text-violet-300 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-violet-400"
            >Clear search</button>}
        </div>
        <p id={hintId} className="mt-2 text-xs text-zinc-400">Search titles, summaries, tags, and places.</p>
    </form>;
}
