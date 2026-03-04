import { useParams, Link } from 'react-router-dom';
import { Suspense } from 'react';
import { MDXProvider } from '@mdx-js/react';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { getPostBySlug } from '../content/posts';
import { mdxComponents } from '../blog/MdxComponents';
import { formatDate } from '../utils/formatDate';

export function BlogPost() {
    const { slug } = useParams<{ slug: string }>();
    const post = slug ? getPostBySlug(slug) : undefined;

    useDocumentHead({
        title: post ? `${post.title} | rsmb` : 'Post Not Found | rsmb',
        description: post?.description ?? 'Blog post not found.',
    });

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
                className="text-sm text-zinc-500 hover:text-violet-400 mb-6 inline-block"
            >
                ← Back to blog
            </Link>

            <header className="mb-8">
                <time className="text-sm text-zinc-500">{formatDate(post.date)}</time>
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

            <Suspense
                fallback={
                    <div className="text-zinc-500 py-8">Loading post…</div>
                }
            >
                <MDXProvider components={mdxComponents}>
                    <Component />
                </MDXProvider>
            </Suspense>
        </article>
    );
}

export default BlogPost;
