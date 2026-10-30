import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TripGallery } from '../../../src/features/trips/components/TripGallery';
import { TripPhoto } from '../../../src/features/trips/components/TripPhoto';
import { TripStoryProvider } from '../../../src/features/trips/TripStoryProvider';
import type { TripManifest } from '../../../src/features/trips/types';
import '../../../src/index.css';

const groups = {
    pair: [1.5, 1.5],
    mixed: [0.75, 4 / 3],
    collage: [2 / 3, 1.5, 1.5, 4 / 3, 1.5],
    six: [2 / 3, 1.5, 1.5, 1.5, 1.5, 1.5],
    uneven: [1.5, 4 / 3, 1.5, 4 / 3, 1.5],
    captions: [0.75, 1.5, 4 / 3, 1.5],
    portrait: [2 / 3],
    landscape: [1.5],
    panorama: [1.5, 5.73, 1.5],
    expanded: [2 / 3, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 4 / 3, 1.5, 0.75, 1.5],
};
const photos = Object.entries(groups).flatMap(([group, ratios]) => ratios.map((ratio, index) => ({
    id: `${group}-${index}`,
    src: `/gallery-fixture/${Math.round(ratio * 1000)}x1000/1600.svg`,
    srcSet: [480, 960, 1600].map(width => `/gallery-fixture/${Math.round(ratio * 1000)}x1000/${width}.svg ${width}w`).join(', '),
    width: Math.round(ratio * 1000), height: 1000,
    alt: `${group} photo ${index + 1}`,
    caption: (group === 'captions' || group === 'portrait') && index === 0
        ? `A long caption must wrap within its own photograph without covering the next row. ${'unbroken'.repeat(20)}`
        : `Caption for ${group} photo ${index + 1}.`,
})));
const manifest: TripManifest = {
    id: 'gallery-test', dates: { start: '2024-01-01', end: '2024-01-01' }, hero: photos[0].id,
    route: { geoJson: '/unused.geojson' }, stops: [], photos,
    galleries: Object.fromEntries(Object.keys(groups).map(group => [group, photos.filter(photo => photo.id.startsWith(`${group}-`)).map(photo => photo.id)])),
};

export function TripGalleriesFixture() {
    return <main className="site-content w-full">
        <article className="site-content-inner mx-auto w-full max-w-3xl px-6 py-12">
            <h1>Adaptive galleries</h1>
            <p data-text-body>The text body sets the width of a single portrait photo.</p>
            <TripStoryProvider manifest={manifest}>
                <div data-photo-example="portrait"><TripPhoto photoId="portrait-0" /></div>
                <div data-photo-example="landscape"><TripPhoto photoId="landscape-0" /></div>
                <div data-photo-example="panorama"><TripPhoto photoId="portrait-0" layout="pano" /></div>
                {Object.keys(groups).map(group => <div key={group} data-gallery-example={group}>
                    <h2>{group}</h2><TripGallery galleryId={group} />
                </div>)}
            </TripStoryProvider>
        </article>
    </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><TripGalleriesFixture /></StrictMode>);
