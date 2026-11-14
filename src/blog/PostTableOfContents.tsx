import { useEffect, useState, type RefObject } from 'react';

interface TableOfContentsItem {
    id: string;
    level: number;
    text: string;
}

interface PostTableOfContentsProps {
    contentRef: RefObject<HTMLElement | null>;
    collapsible?: boolean;
}

function itemsMatch(currentItems: TableOfContentsItem[], nextItems: TableOfContentsItem[]) {
    return currentItems.length === nextItems.length && currentItems.every((item, index) => (
        item.id === nextItems[index].id
        && item.level === nextItems[index].level
        && item.text === nextItems[index].text
    ));
}

function getHeadingText(heading: HTMLElement) {
    const copy = heading.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[data-heading-anchor]').forEach((anchor) => anchor.remove());
    return copy.textContent?.trim() ?? '';
}

function currentHashId() {
    try {
        return decodeURIComponent(window.location.hash.slice(1));
    } catch {
        return window.location.hash.slice(1);
    }
}

export function PostTableOfContents({ contentRef, collapsible = false }: PostTableOfContentsProps) {
    const [expanded, setExpanded] = useState(true);
    const [activeId, setActiveId] = useState('');
    const [items, setItems] = useState<TableOfContentsItem[]>([]);

    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;

        let hasScrolledToHash = false;
        let hashScrollFrame: number | undefined;
        const updateItems = () => {
            const firstMap = content.querySelector<HTMLElement>('[data-trip-map]');
            if (firstMap && !firstMap.id) firstMap.id = 'trip-route';
            const headings = Array.from(content.querySelectorAll<HTMLElement>('[data-post-heading]'));
            const nextItems = headings.map((heading) => ({
                id: heading.id,
                level: Number(heading.tagName.slice(1)),
                text: getHeadingText(heading),
            })).filter((item) => item.id && item.text);

            setItems((currentItems) => (itemsMatch(currentItems, nextItems) ? currentItems : nextItems));

            const hashId = currentHashId();
            const hashTarget = headings.find((heading) => heading.id === hashId);
            if (hashTarget && !hasScrolledToHash) {
                hasScrolledToHash = true;
                if (hashScrollFrame !== undefined) cancelAnimationFrame(hashScrollFrame);
                hashScrollFrame = requestAnimationFrame(() => {
                    hashScrollFrame = undefined;
                    hashTarget.scrollIntoView();
                });
            }
        };
        const handleHashChange = () => {
            hasScrolledToHash = false;
            updateItems();
        };

        updateItems();
        const observer = new MutationObserver(updateItems);
        observer.observe(content, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['id', 'data-post-heading'],
        });
        window.addEventListener('hashchange', handleHashChange);
        return () => {
            observer.disconnect();
            window.removeEventListener('hashchange', handleHashChange);
            if (hashScrollFrame !== undefined) cancelAnimationFrame(hashScrollFrame);
        };
    }, [contentRef]);

    useEffect(() => {
        if (!items.length || typeof IntersectionObserver === 'undefined') return;
        const visibleHeadings = new Set<Element>();
        const observer = new IntersectionObserver(entries => {
            // Notifications contain only changed intersections, not every visible heading.
            for (const entry of entries) {
                if (entry.isIntersecting) visibleHeadings.add(entry.target);
                else visibleHeadings.delete(entry.target);
            }
            const first = [...visibleHeadings]
                .map(heading => ({ heading, top: heading.getBoundingClientRect().top }))
                .sort((a, b) => a.top - b.top)[0];
            if (first) setActiveId(first.heading.id);
        }, { rootMargin: '-80px 0px -60% 0px' });
        for (const item of items) {
            const heading = document.getElementById(item.id);
            if (heading) observer.observe(heading);
        }
        return () => observer.disconnect();
    }, [items]);

    if (items.length === 0) return null;

    return (
        <nav
            id="post-table-of-contents"
            aria-label="Table of contents"
            className="scroll-mt-24 mb-8 border-l border-zinc-700 pl-4"
        >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-zinc-300">Table of contents</p>
                <button type="button" aria-expanded={expanded} aria-controls="post-contents-list" className={`min-h-11 px-3 text-sm text-violet-300 ${collapsible ? '' : 'sm:hidden'}`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Collapse' : 'Expand'}</button></div>
            <ul id="post-contents-list" className={`${expanded ? '' : collapsible ? 'hidden ' : 'hidden sm:block '}space-y-1 text-sm`}>
                {items.map((item) => (
                    <li key={item.id} className={item.level >= 3 ? 'pl-4' : undefined}>
                        <a aria-current={activeId === item.id ? 'location' : undefined} className="inline-block py-1 text-zinc-300 hover:text-violet-300 aria-[current=location]:text-violet-300" href={`#${item.id}`}>
                            {item.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
