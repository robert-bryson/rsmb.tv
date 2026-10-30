import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTripStory } from '../TripStoryContext';
import type { TripManifest } from '../types';

type Animation = NonNullable<TripManifest['animations']>[number];

function AnimationPlayer({ animation }: { animation: Animation }) {
    const videoId = `trip-animation-${useId().replaceAll(':', '')}`;
    const figureRef = useRef<HTMLElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const reducedMotion = useReducedMotion();
    const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
    const [loaded, setLoaded] = useState(visible);
    const [pageVisible, setPageVisible] = useState(!document.hidden);
    const [intent, setIntent] = useState<'auto' | 'play' | 'pause'>('auto');
    const [playing, setPlaying] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const figure = figureRef.current;
        if (!figure) return;
        if (typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            const inView = entries.some(entry => entry.isIntersecting);
            setVisible(inView);
            if (inView) setLoaded(true);
        }, { threshold: 0.1 });
        observer.observe(figure);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const update = () => setPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !loaded || failed) return;
        let current = true;
        if (visible && pageVisible && (intent === 'play' || (intent === 'auto' && !reducedMotion))) {
            void video.play()?.catch(() => {
                if (current) setPlaying(false);
            });
        } else {
            video.pause();
        }
        return () => { current = false; video.pause(); };
    }, [visible, loaded, pageVisible, intent, reducedMotion, failed]);

    const togglePlayback = () => {
        const video = videoRef.current;
        if (!video) return;
        if (playing) {
            setIntent('pause');
            video.pause();
        } else {
            setLoaded(true);
            setIntent('play');
            // Keep manual playback in the click gesture for browsers that block autoplay.
            if (loaded) void video.play()?.catch(() => {
                // An older request can reject after a later playback has already started.
                if (videoRef.current === video) setPlaying(!video.paused);
            });
        }
    };

    return <figure ref={figureRef} className="my-8 w-full" data-trip-animation>
        <div className="trip-animation-frame relative">
            {failed ? <img src={animation.poster} width={animation.width} height={animation.height}
                alt={animation.alt} className="block h-auto w-full rounded-md" /> : <video
                ref={videoRef} id={videoId} src={loaded ? animation.src : undefined} poster={animation.poster}
                width={animation.width} height={animation.height} aria-label={animation.alt}
                muted loop playsInline preload="none" disablePictureInPicture
                className="block h-auto w-full rounded-md border border-zinc-800"
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}
            />}
            {!failed && <button type="button" aria-controls={videoId} onClick={togglePlayback}
                className="trip-animation-control absolute bottom-3 right-3 min-h-11 cursor-pointer rounded border border-zinc-600 bg-zinc-950/85 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-violet-400">
                {playing ? 'Pause animation' : 'Play animation'}
            </button>}
        </div>
        <figcaption className="mt-2 text-sm text-zinc-400">
            {animation.caption && <p className="mb-2">{animation.caption}</p>}
            {(failed || animation.attribution) && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {failed && <span role="status">Animation unavailable.</span>}
                {animation.attribution && <a href={animation.attribution.url} target="_blank" rel="noopener noreferrer"
                    className="text-violet-400 underline underline-offset-2">{animation.attribution.label}</a>}
            </div>}
        </figcaption>
    </figure>;
}

export function TripAnimation({ animationId }: { animationId: string }) {
    const { manifest } = useTripStory();
    const animation = manifest.animations?.find(animation => animation.id === animationId);
    if (!animation) throw new Error(`Unknown trip animation: ${animationId}`);
    return <AnimationPlayer key={animation.src} animation={animation} />;
}
