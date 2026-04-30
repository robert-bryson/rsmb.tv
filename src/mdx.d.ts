declare module '*.mdx' {
    import type { ComponentType } from 'react';

    export const frontmatter: Record<string, unknown>;

    const MDXComponent: ComponentType<{ components?: Record<string, unknown> }>;
    export default MDXComponent;
}
