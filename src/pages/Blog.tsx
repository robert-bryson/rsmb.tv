import { Link, useSearchParams } from 'react-router-dom';
import { BlogAllTagsLink, BlogTagLink } from '../components/BlogTagLink';
import { filterPostsByTag, getAllBlogTags } from '../content/blogTags';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { getAllPosts } from '../content/posts';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

const description = 'Thoughts on projects, engineering, and things I find interesting.';

export function Blog() {
    const allPosts = getAllPosts();
    const [searchParams] = useSearchParams();
    const activeTag = searchParams.get('tag')?.trim() ?? '';
    const allTags = getAllBlogTags(allPosts);
    const posts = filterPostsByTag(allPosts, activeTag);

    useDocumentHead({
        title: 'Blog | rsmb',
        description,
        ogImage: absoluteUrl('/og/blog.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'rsmb Blog',
        description,
        url: absoluteUrl('/blog'),
        author: AUTHOR_PERSON,
        blogPost: allPosts.map((post) => ({
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            url: absoluteUrl(`/blog/${post.slug}`),
            image: absoluteUrl(`/og/blog/${post.slug}.svg`),
            author: AUTHOR_PERSON,
            keywords: post.tags,
        })),
    });

    return (
        <div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Blog</h1>
            <p className="text-zinc-400 mb-6">
                Thoughts on projects, engineering, and things I find interesting.
            </p>

            {allTags.length > 0 && (
                <nav aria-label="Blog tags" className="flex flex-wrap gap-2 mb-8">
                    <BlogAllTagsLink active={!activeTag} />
                    {allTags.map((tag) => (
                        <BlogTagLink
                            key={tag}
                            tag={tag}
                            active={activeTag === tag}
                        />
                    ))}
                </nav>
            )}

            {posts.length === 0 ? (
                <p className="text-zinc-400">
                    {activeTag ? `No posts tagged "${activeTag}".` : 'No posts yet. Check back soon.'}
                </p>
            ) : (
                <ul className="space-y-6">
                    {posts.map((post) => (
                        <li key={post.slug}>
                            <Link
                                to={`/blog/${post.slug}`}
                                className="group block"
                            >
                                <time className="text-sm text-zinc-400">{formatDate(post.date)}</time>
                                <h2 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400 mt-1">
                                    {post.title}
                                </h2>
                                <p className="text-zinc-400 text-sm mt-1">{post.description}</p>
                            </Link>
                            {post.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {post.tags.map((tag) => (
                                        <BlogTagLink
                                            key={tag}
                                            tag={tag}
                                            active={activeTag === tag}
                                        />
                                    ))}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
