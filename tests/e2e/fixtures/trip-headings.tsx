import { StrictMode, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../../../src/components/Layout';
import { PostHeadingProvider } from '../../../src/blog/LinkedHeading';
import { mdxComponents } from '../../../src/blog/MdxComponents';
import { PostTableOfContents } from '../../../src/blog/PostTableOfContents';
import Content from '../../fixtures/trip-chapters.mdx';
import '../../../src/index.css';

export function TripHeadingsFixture() {
    const contentRef = useRef<HTMLDivElement>(null);
    return <MemoryRouter initialEntries={['/trips/coast']}>
        <Layout>
            <article className="trip-story">
                <h1 data-trip-title>Coast trip</h1>
                <PostHeadingProvider>
                    <PostTableOfContents contentRef={contentRef} />
                    <div ref={contentRef} id="trip-story-body"><Content components={mdxComponents} /></div>
                </PostHeadingProvider>
                <div data-after-story style={{ minHeight: '150vh' }}>After the story.</div>
            </article>
        </Layout>
    </MemoryRouter>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><TripHeadingsFixture /></StrictMode>);
