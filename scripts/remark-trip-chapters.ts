import type { Root, RootContent } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx';
import { parse } from 'yaml';

/** Give each trip chapter a boundary for native CSS sticky-heading handoffs. */
export function remarkTripChapters() {
    return (tree: Root) => {
        const frontmatter = tree.children.find(node => node.type === 'yaml');
        if (!frontmatter) return;
        const metadata: unknown = parse(frontmatter.value);
        if (!metadata || typeof metadata !== 'object' || !('format' in metadata) || metadata.format !== 'trip') return;

        // The story title lives outside MDX. Imported chapters normally use h2;
        // authored h1 chapters take precedence over their h2 subsections.
        const depth = tree.children.some(node => node.type === 'heading' && node.depth === 1) ? 1 : 2;
        const children: RootContent[] = [];
        let chapter: MdxJsxFlowElement | undefined;
        for (const node of tree.children) {
            if (node.type === 'heading' && node.depth === depth) {
                chapter = {
                    type: 'mdxJsxFlowElement',
                    name: 'section',
                    attributes: [{ type: 'mdxJsxAttribute', name: 'className', value: 'trip-chapter' }],
                    children: [node],
                };
                children.push(chapter);
            } else if (chapter && node.type !== 'mdxjsEsm' && node.type !== 'yaml') {
                // The MDX parser emits flow content at the root. mdast's wider
                // RootContent type also permits standalone inline nodes.
                chapter.children.push(node as MdxJsxFlowElement['children'][number]);
            } else {
                children.push(node);
            }
        }
        tree.children = children;
    };
}
