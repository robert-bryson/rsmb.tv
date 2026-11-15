import { useId, type RefObject } from 'react';

interface ContentSearchProps {
    label: string;
    hint: string;
    placeholder: string;
    query: string;
    onChange: (query: string) => void;
    onCommit?: () => void;
    inputRef: RefObject<HTMLInputElement | null>;
}

export function ContentSearch({ label, hint, placeholder, query, onChange, onCommit, inputRef }: ContentSearchProps) {
    const id = useId();
    const hintId = `${id}-hint`;
    return <form role="search" aria-label={label} onSubmit={event => { event.preventDefault(); onCommit?.(); }} className="mb-6">
        <label htmlFor={id} className="mb-2 block text-sm font-medium text-zinc-200">{label}</label>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 focus-within:border-violet-400">
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
                onBlur={onCommit}
                aria-describedby={hintId}
                placeholder={placeholder}
                className="min-h-11 min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-base text-zinc-100 placeholder:text-zinc-400"
            />
            {query && <button
                type="button"
                onClick={() => { onChange(''); inputRef.current?.focus(); }}
                className="mr-1 min-h-11 rounded-md px-3 text-sm text-violet-300 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-violet-400"
            >Clear search</button>}
        </div>
        <p id={hintId} className="mt-2 text-xs text-zinc-400">{hint}</p>
    </form>;
}
