import { StrictMode, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PostHeadingProvider } from '../../../src/blog/LinkedHeading';
import { mdxComponents } from '../../../src/blog/MdxComponents';
import { PostTableOfContents } from '../../../src/blog/PostTableOfContents';
import Content from '../../fixtures/google-doc.mdx';
import '../../../src/index.css';

export function PostFixture() {
    const contentRef = useRef<HTMLDivElement>(null);
    return (
        <PostHeadingProvider>
            <main className="mx-auto max-w-3xl p-6">
                <PostTableOfContents contentRef={contentRef} />
                <a href="#first-stop" className="text-zinc-400 hover:text-violet-400">Site link</a>
                <div ref={contentRef} id="trip-story-body" className="test-post">
                    <Content components={mdxComponents} />
                    <p className="text-zinc-300">
                        <u><a href="/posts">Plain article link</a></u>
                        {' '}
                        <u><a href="/posts" style={{ color: '#d4d4d8' }}>
                            <span style={{ color: '#d4d4d8' }}>Imported article link</span>
                        </a></u>
                    </p>
                </div>
                <div aria-hidden="true" style={{ height: '100vh' }} />
            </main>
        </PostHeadingProvider>
    );
}

createRoot(document.getElementById('root')!).render(<StrictMode><PostFixture /></StrictMode>);
