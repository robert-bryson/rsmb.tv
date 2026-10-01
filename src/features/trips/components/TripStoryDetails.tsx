import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { PostTableOfContents } from '../../../blog/PostTableOfContents';
import { PostTagLink } from '../../../components/PostTagLink';
import type { BlogPostMeta } from '../../../content/posts';
import { formatDate } from '../../../utils/formatDate';
import { useTripStory } from '../TripStoryContext';
import { TripFacts } from './TripFacts';

// The story loads as MDX. Its first map supplies stable slots so the opening
// paragraphs remain uninterrupted, including when the map itself loads lazily.
export function TripStoryDetails({ post, contentRef }: {
    post: BlogPostMeta;
    contentRef: RefObject<HTMLDivElement | null>;
}) {
    const { manifest } = useTripStory();
    const [slots, setSlots] = useState<{ facts: HTMLElement | null; navigation: HTMLElement | null }>({ facts: null, navigation: null });
    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;
        const findSlots = () => {
            const facts = content.querySelector<HTMLElement>('[data-trip-facts-slot]');
            const navigation = content.querySelector<HTMLElement>('[data-trip-navigation-slot]');
            setSlots(current => current.facts === facts && current.navigation === navigation ? current : { facts, navigation });
        };
        findSlots();
        const observer = new MutationObserver(findSlots);
        observer.observe(content, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [contentRef]);

    const navigation = <div className="my-8">
        <PostTableOfContents contentRef={contentRef} collapsible />
        {manifest.days && <nav aria-label="Trip days" className="mb-6 flex flex-wrap gap-2 text-sm">{manifest.days.map(day => <a key={day.id} href={`#${day.headingId}`} className="rounded bg-zinc-900 px-3 py-2 text-violet-300">{day.title}{day.date ? ` · ${formatDate(day.date)}` : ''}</a>)}</nav>}
        <div className="flex flex-wrap items-center justify-between gap-4">
            <nav aria-label="Trip shortcuts" className="flex flex-wrap gap-4 text-sm text-violet-300">
                <a className="inline-flex min-h-11 items-center" href="#trip-story-body">Introduction</a>
                <a className="inline-flex min-h-11 items-center" href="#trip-route">Route</a>
                <a className="inline-flex min-h-11 items-center" href="#trip-photos">Photos</a>
            </nav>
        </div>
        {post.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{post.tags.map(tag => <PostTagLink key={tag} tag={tag} type="trips" />)}</div>}
    </div>;
    return <>
        {slots.facts ? createPortal(<TripFacts />, slots.facts) : <TripFacts />}
        {slots.navigation ? createPortal(navigation, slots.navigation) : navigation}
    </>;
}
