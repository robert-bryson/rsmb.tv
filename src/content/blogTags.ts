import type { BlogPostMeta } from './posts';

type TaggedPost = Pick<BlogPostMeta, 'tags'>;

export function getAllBlogTags(posts: TaggedPost[]): string[] {
    return Array.from(new Set(posts.flatMap((post) => post.tags))).sort((firstTag, secondTag) =>
        firstTag.localeCompare(secondTag),
    );
}

export function filterPostsByTag<Post extends TaggedPost>(
    posts: Post[],
    tag: string | null | undefined,
): Post[] {
    const selectedTag = tag?.trim();

    if (!selectedTag) {
        return posts;
    }

    return posts.filter((post) => post.tags.includes(selectedTag));
}

export function createBlogTagSearch(tag: string): string {
    const selectedTag = tag.trim();

    if (!selectedTag) {
        return '';
    }

    const params = new URLSearchParams({ tag: selectedTag });
    return `?${params.toString()}`;
}
