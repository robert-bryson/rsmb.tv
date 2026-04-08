import type { ComponentPropsWithoutRef } from 'react';

/**
 * Custom MDX component overrides for consistent blog styling.
 * These map standard HTML elements to Tailwind-styled versions.
 */
export const mdxComponents = {
    h1: (props: ComponentPropsWithoutRef<'h1'>) => (
        <h1 className="text-3xl font-bold text-zinc-100 mt-10 mb-4" {...props} />
    ),
    h2: (props: ComponentPropsWithoutRef<'h2'>) => (
        <h2 className="text-2xl font-semibold text-zinc-100 mt-8 mb-3" {...props} />
    ),
    h3: (props: ComponentPropsWithoutRef<'h3'>) => (
        <h3 className="text-xl font-semibold text-zinc-200 mt-6 mb-2" {...props} />
    ),
    p: (props: ComponentPropsWithoutRef<'p'>) => (
        <p className="text-zinc-300 leading-relaxed mb-4" {...props} />
    ),
    a: (props: ComponentPropsWithoutRef<'a'>) => {
        const isExternal = props.href && /^https?:\/\//.test(props.href);
        return (
            <a
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                {...props}
            />
        );
    },
    ul: (props: ComponentPropsWithoutRef<'ul'>) => (
        <ul className="list-disc list-inside text-zinc-300 mb-4 space-y-1" {...props} />
    ),
    ol: (props: ComponentPropsWithoutRef<'ol'>) => (
        <ol className="list-decimal list-inside text-zinc-300 mb-4 space-y-1" {...props} />
    ),
    li: (props: ComponentPropsWithoutRef<'li'>) => (
        <li className="text-zinc-300" {...props} />
    ),
    blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
        <blockquote
            className="border-l-2 border-violet-500/50 pl-4 italic text-zinc-400 my-4"
            {...props}
        />
    ),
    code: (props: ComponentPropsWithoutRef<'code'>) => (
        <code
            className="bg-zinc-800 text-violet-300 rounded px-1.5 py-0.5 text-sm font-mono"
            {...props}
        />
    ),
    pre: (props: ComponentPropsWithoutRef<'pre'>) => (
        <pre
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto mb-4 text-sm"
            {...props}
        />
    ),
    img: (props: ComponentPropsWithoutRef<'img'>) => (
        <img
            className="rounded-lg border border-zinc-800 my-4"
            loading="lazy"
            {...props}
        />
    ),
    hr: (props: ComponentPropsWithoutRef<'hr'>) => (
        <hr className="border-zinc-800 my-8" {...props} />
    ),
    strong: (props: ComponentPropsWithoutRef<'strong'>) => (
        <strong className="text-zinc-100 font-semibold" {...props} />
    ),
};
