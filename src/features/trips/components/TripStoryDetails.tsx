import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { PostTableOfContents } from '../../../blog/PostTableOfContents';
import { TripFacts } from './TripFacts';

// The story loads as MDX. Its first map supplies stable slots so the opening
// paragraphs remain uninterrupted, including when the map itself loads lazily.
export function TripStoryDetails({ contentRef }: {
    contentRef: RefObject<HTMLDivElement | null>;
}) {
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
    </div>;
    return <>
        {slots.facts ? createPortal(<TripFacts />, slots.facts) : <TripFacts />}
        {slots.navigation ? createPortal(navigation, slots.navigation) : navigation}
    </>;
}
