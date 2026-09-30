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
                <div ref={contentRef} className="test-post"><Content components={mdxComponents} /></div>
                <div aria-hidden="true" style={{ height: '100vh' }} />
            </main>
        </PostHeadingProvider>
    );
}

createRoot(document.getElementById('root')!).render(<StrictMode><PostFixture /></StrictMode>);
