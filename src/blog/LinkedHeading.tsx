import {
    Children,
    createContext,
    isValidElement,
    useCallback,
    useContext,
    useMemo,
    useRef,
    type HTMLAttributes,
    type ReactNode,
} from 'react';

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const HeadingIdContext = createContext<((baseId: string) => string) | null>(null);

export function PostHeadingProvider({ children }: { children: ReactNode }) {
    const idCounts = useRef(new Map([['post-table-of-contents', 1]]));

    const reserveId = useCallback((baseId: string) => {
        const duplicateIndex = idCounts.current.get(baseId) ?? 0;
        idCounts.current.set(baseId, duplicateIndex + 1);
        return duplicateIndex === 0 ? baseId : `${baseId}-${duplicateIndex}`;
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
    const anchorId = useMemo(() => reserveId?.(baseId) ?? baseId, [baseId, reserveId]);

    return (
        <Heading
            {...props}
            id={anchorId}
            aria-label={text}
            data-post-heading
            className={`group scroll-mt-24 ${className ?? ''}`}
        >
            {children}
            <a
                href={`#${anchorId}`}
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