import { useEffect, useState, type RefObject } from 'react';

interface TableOfContentsItem {
    id: string;
    level: number;
    text: string;
}

interface PostTableOfContentsProps {
    contentRef: RefObject<HTMLElement | null>;
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

export function PostTableOfContents({ contentRef }: PostTableOfContentsProps) {
    const [items, setItems] = useState<TableOfContentsItem[]>([]);

    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;

        let hasScrolledToHash = false;
        let hashScrollFrame: number | undefined;
        const updateItems = () => {
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
        observer.observe(content, { childList: true, subtree: true });
        window.addEventListener('hashchange', handleHashChange);
        return () => {
            observer.disconnect();
            window.removeEventListener('hashchange', handleHashChange);
            if (hashScrollFrame !== undefined) cancelAnimationFrame(hashScrollFrame);
        };
    }, [contentRef]);

    if (items.length === 0) return null;

    return (
        <nav
            id="post-table-of-contents"
            aria-label="Table of contents"
            className="scroll-mt-24 mb-8 border-l border-zinc-700 pl-4"
        >
            <p className="mb-2 text-sm font-medium text-zinc-300">On this page</p>
            <ul className="space-y-1 text-sm">
                {items.map((item) => (
                    <li key={item.id} className={item.level >= 3 ? 'pl-4' : undefined}>
                        <a className="text-zinc-400 hover:text-violet-400" href={`#${item.id}`}>
                            {item.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}