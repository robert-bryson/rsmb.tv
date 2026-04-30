import { useParams, Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { getPostBySlug } from '../content/posts';
import { mdxComponents } from '../blog/MdxComponents';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, SITE_URL, absoluteUrl } from '../utils/siteMetadata';

export function BlogPost() {
    const { slug } = useParams<{ slug: string }>();
    const post = slug ? getPostBySlug(slug) : undefined;
    const postUrl = post ? absoluteUrl(`/blog/${post.slug}`) : undefined;
    const postImage = post ? absoluteUrl(`/og/blog/${post.slug}.svg`) : undefined;

    useDocumentHead({
        title: post ? `${post.title} | rsmb` : 'Post Not Found | rsmb',
        description: post?.description ?? 'Blog post not found.',
        ogImage: postImage,
    });

    useJsonLd(post ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        author: AUTHOR_PERSON,
        url: postUrl,
        image: postImage,
        keywords: post.tags,
    } : null);

    useJsonLd(post ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: absoluteUrl('/blog') },
            { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
        ],
    } : null);

    if (!post) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-zinc-100 mb-4">Post not found</h1>
                <Link to="/blog" className="text-violet-400 hover:text-violet-300">
                    ← Back to blog
                </Link>
            </div>
        );
    }

    const { Component } = post;

    return (
        <article>
            <Link
                to="/blog"
                className="text-sm text-zinc-400 hover:text-violet-400 mb-6 inline-block"
            >
                ← Back to blog
            </Link>

            <header className="mb-8">
                <time className="text-sm text-zinc-400">{formatDate(post.date)}</time>
                <h1 className="text-3xl font-bold text-zinc-100 mt-2">{post.title}</h1>
                {post.tags.length > 0 && (
                    <div className="flex gap-2 mt-3">
                        {post.tags.map((tag) => (
                            <span
                                key={tag}
                                className="text-xs bg-zinc-800 text-zinc-400 rounded-full px-2.5 py-0.5"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </header>

            <Component components={mdxComponents} />
        </article>
    );
}
