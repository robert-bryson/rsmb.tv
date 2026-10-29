import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TripAnimation } from '../features/trips/components/TripAnimation';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { tripManifestSchema } from '../../shared/tripManifestSchema';
import coastal from '../../tests/fixtures/trip-content/trips/coastal-test.json';

const animation = {
    id: 'speeders', src: '/media/trips/coastal-test/speeders-012345abcdef.mp4',
    poster: '/media/trips/coastal-test/speeders-012345abcdef.webp',
    width: 480, height: 208, alt: 'A rider races through a forest.',
    caption: 'A film reference.', attribution: { label: 'via GIPHY', url: 'https://giphy.com/gifs/example' },
};
const manifest = tripManifestSchema.parse({ ...coastal, animations: [animation] });
let intersect: (visible: boolean) => void;
let reducedMotion = false;
let motionChanged: () => void;
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    reducedMotion = false;
    vi.stubGlobal('matchMedia', () => ({
        get matches() { return reducedMotion; },
        addEventListener: (_event: string, callback: () => void) => { motionChanged = callback; },
        removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('IntersectionObserver', class {
        constructor(callback: IntersectionObserverCallback) {
            intersect = visible => callback([{ isIntersecting: visible }] as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
        }
        observe() {}
        disconnect() {}
    });
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
    });
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event('pause'));
    });
});

describe('review regressions: animation lifecycle', () => {
    it('plays without IntersectionObserver and pauses on unmount', () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        const { video, unmount } = renderAnimation();
        expect(video).toHaveAttribute('src', animation.src);
        expect(play).toHaveBeenCalled();
        pause.mockClear();
        unmount();
        expect(pause).toHaveBeenCalled();
    });

    it('retains reduced motion behavior without IntersectionObserver', () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        reducedMotion = true;
        renderAnimation();
        expect(play).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Play animation' }));
        expect(play).toHaveBeenCalled();
    });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function renderAnimation() {
    const result = render(<TripStoryProvider manifest={manifest}><TripAnimation animationId="speeders" /></TripStoryProvider>);
    return { ...result, video: result.container.querySelector('video')! };
}

describe('trip animations', () => {
    it('reserves the correct size and defers video loading until visible', () => {
        const { video } = renderAnimation();
        expect(video).not.toHaveAttribute('src');
        expect(video).toHaveAttribute('poster', animation.poster);
        expect(video).toHaveAttribute('width', '480');
        expect(video).toHaveAttribute('height', '208');
        expect(video).toHaveAttribute('preload', 'none');
        expect(video).toHaveAttribute('playsinline');
        expect(video.muted).toBe(true);
        expect(play).not.toHaveBeenCalled();
        expect(screen.getByRole('link', { name: 'via GIPHY' })).toHaveAttribute('href', animation.attribution.url);
        act(() => intersect(true));
        expect(video).toHaveAttribute('src', animation.src);
        expect(screen.getByRole('button', { name: 'Pause animation' })).toBeVisible();
    });

    it('keeps a user pause after scrolling away and back, and allows playback again', () => {
        renderAnimation();
        act(() => intersect(true));
        fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }));
        play.mockClear();
        act(() => intersect(false));
        act(() => intersect(true));
        expect(play).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Play animation' }));
        expect(screen.getByRole('button', { name: 'Pause animation' })).toBeVisible();
    });

    it('shows a still poster with reduced motion until the reader chooses playback', () => {
        reducedMotion = true;
        renderAnimation();
        act(() => intersect(true));
        expect(play).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Play animation' }));
        expect(play).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Pause animation' })).toBeVisible();
    });

    it('pauses automatic playback when reduced motion is enabled or the video leaves view', () => {
        renderAnimation();
        act(() => intersect(true));
        pause.mockClear();
        act(() => { reducedMotion = true; motionChanged(); });
        expect(pause).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Play animation' })).toBeVisible();
        act(() => { reducedMotion = false; motionChanged(); });
        expect(screen.getByRole('button', { name: 'Pause animation' })).toBeVisible();
        act(() => intersect(false));
        expect(screen.getByRole('button', { name: 'Play animation' })).toBeVisible();
    });

    it('pauses when the tab is hidden and resumes automatic playback when visible', () => {
        renderAnimation();
        act(() => intersect(true));
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        fireEvent(document, new Event('visibilitychange'));
        expect(screen.getByRole('button', { name: 'Play animation' })).toBeVisible();
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        fireEvent(document, new Event('visibilitychange'));
        expect(screen.getByRole('button', { name: 'Pause animation' })).toBeVisible();
    });

    it('retains the poster and source attribution when the clip fails', () => {
        const { video } = renderAnimation();
        fireEvent.error(video);
        expect(screen.getByRole('img', { name: animation.alt })).toHaveAttribute('src', animation.poster);
        expect(screen.getByRole('status')).toHaveTextContent('Animation unavailable.');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'via GIPHY' })).toBeVisible();
    });

    it('offers manual playback if the browser rejects autoplay', async () => {
        play.mockRejectedValue(new DOMException('Autoplay blocked', 'NotAllowedError'));
        renderAnimation();
        await act(async () => intersect(true));
        expect(screen.getByRole('button', { name: 'Play animation' })).toBeVisible();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('retains the current play state when an older manual request rejects', async () => {
        reducedMotion = true;
        let rejectEarlier!: (error: Error) => void;
        play.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectEarlier = reject; }));
        const { video } = renderAnimation();
        vi.spyOn(video, 'paused', 'get').mockReturnValue(false);
        act(() => intersect(true));
        fireEvent.click(screen.getByRole('button', { name: 'Play animation' }));
        expect(screen.getByRole('button', { name: 'Pause animation' })).toBeVisible();
        await act(async () => rejectEarlier(new DOMException('Superseded playback', 'AbortError')));
        expect(screen.getByRole('button', { name: 'Pause animation' })).toBeVisible();
    });
});
