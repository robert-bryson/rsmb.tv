import {
    Children,
    createContext,
    isValidElement,
    useCallback,
    useContext,
    useRef,
    useState,
    type HTMLAttributes,
    type ReactNode,
} from 'react';

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface HeadingIdReservation {
    id: string;
    release: () => void;
}

const HeadingIdContext = createContext<((baseId: string) => HeadingIdReservation) | null>(null);

export function PostHeadingProvider({ children }: { children: ReactNode }) {
    const reservedIds = useRef(new Set(['post-table-of-contents']));

    const reserveId = useCallback((baseId: string): HeadingIdReservation => {
        const ids = reservedIds.current;
        let id = baseId;
        for (let suffix = 1; ids.has(id); suffix += 1) id = `${baseId}-${suffix}`;
        ids.add(id);
        return { id, release: () => { ids.delete(id); } };
    }, []);

    return <HeadingIdContext value={reserveId}>{children}</HeadingIdContext>;
}

function headingText(children: ReactNode): string {
    return Children.toArray(children).map((child) => {
        if (typeof child === 'string' || typeof child === 'number') return String(child);
        if (isValidElement<{ children?: ReactNode }>(child)) return headingText(child.props.children);
        return '';
    }).join('');
}

function headingId(children: ReactNode): string {
    return headingText(children)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section';
}

export function LinkedHeading({
    as: Heading,
    children,
    className,
    id,
    ...props
}: HTMLAttributes<HTMLHeadingElement> & { as: HeadingTag }) {
    const text = headingText(children);
    const baseId = id ?? headingId(children);
    const reserveId = useContext(HeadingIdContext);
    const [reservation, setReservation] = useState<{ baseId: string; id: string } | null>(null);
    // Reserve IDs only when React commits the node. Discarded renders must not consume IDs.
    const headingRef = useCallback((node: HTMLHeadingElement | null) => {
        if (!node || !reserveId) return;
        const reserved = reserveId(baseId);
        setReservation({ baseId, id: reserved.id });
        return reserved.release;
    }, [baseId, reserveId]);
    const anchorId = reserveId ? (reservation?.baseId === baseId ? reservation.id : undefined) : baseId;

    return (
        <Heading
            {...props}
            ref={headingRef}
            id={anchorId}
            aria-label={text}
            data-post-heading={anchorId ? true : undefined}
            className={`group scroll-mt-24 ${className ?? ''}`}
        >
            {children}
            <a
                href={anchorId ? `#${anchorId}` : undefined}
                aria-label={`Link to ${text}`}
                data-heading-anchor
                className="ml-1 inline-flex min-h-6 min-w-6 items-center justify-center text-zinc-500 no-underline opacity-60 transition-opacity hover:text-violet-400 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100"
            >
                #
            </a>
            <a
                href="#post-table-of-contents"
                aria-label="Back to table of contents"
                data-heading-anchor
                className="inline-flex min-h-6 min-w-6 items-center justify-center text-zinc-500 no-underline opacity-60 transition-opacity hover:text-violet-400 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100"
            >
                ↑
            </a>
        </Heading>
    );
}