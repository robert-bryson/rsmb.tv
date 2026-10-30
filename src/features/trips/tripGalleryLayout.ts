import type { TripPhotoData } from './types';

export const TRIP_GALLERY_GAP = 12;
const PANORAMA_RATIO = 2.5;

// A length relative to the gallery: fraction * galleryWidth + pixels.
interface GalleryLength { fraction: number; pixels: number }
export interface TripGalleryPlacement {
    row: number;
    rowSpan: number;
    width: GalleryLength;
    offset: GalleryLength;
}
interface Candidate {
    placements: TripGalleryPlacement[];
    rows: number;
    cost: number;
}

function rowPlacements(ratios: readonly number[], row: number, width: GalleryLength, offset: GalleryLength): TripGalleryPlacement[] {
    const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
    const gaps = (ratios.length - 1) * TRIP_GALLERY_GAP;
    let preceding = 0;
    return ratios.map((ratio, index) => {
        const share = ratio / total;
        const before = preceding / total;
        preceding += ratio;
        return {
            row, rowSpan: 1,
            width: { fraction: share * width.fraction, pixels: share * (width.pixels - gaps) },
            offset: {
                fraction: offset.fraction + before * width.fraction,
                pixels: offset.pixels + before * (width.pixels - gaps) + index * TRIP_GALLERY_GAP,
            },
        };
    });
}

function heightCost(height: number, target: number, count: number) {
    return Math.log(height / target) ** 2 * count;
}

/** Partition consecutive photos into filled rows, with optional leading-portrait collages. */
export function layoutTripGallery(photos: readonly Pick<TripPhotoData, 'width' | 'height'>[], wide: boolean): TripGalleryPlacement[] {
    const ratios = photos.map(photo => photo.width / photo.height);
    const targetHeight = wide ? 0.28 : 0.45;
    const costs = Array<number>(photos.length + 1).fill(Infinity);
    const choices = Array<Candidate | undefined>(photos.length);
    costs[photos.length] = 0;

    for (let start = photos.length - 1; start >= 0; start--) {
        const consider = (candidate: Candidate) => {
            // Prefer compact groups without reducing portraits to narrow slivers.
            const minimumShare = wide ? 0.24 : 0.3;
            const narrowTileCost = candidate.placements.reduce((sum, tile) => sum
                + Math.min(1, Math.max(0, minimumShare / tile.width.fraction - 1) ** 2 * 8), 0);
            const cost = candidate.cost + candidate.rows * 0.75 + narrowTileCost
                + costs[start + candidate.placements.length];
            if (cost < costs[start]) {
                costs[start] = cost;
                choices[start] = candidate;
            }
        };
        for (let count = 1; count <= (wide ? 3 : 2) && start + count <= photos.length; count++) {
            const row = ratios.slice(start, start + count);
            // A panorama gets a complete row instead of making its neighbors tiny.
            if (count > 1 && row.some(ratio => ratio >= PANORAMA_RATIO)) break;
            const aspect = row.reduce((sum, ratio) => sum + ratio, 0);
            consider({
                placements: rowPlacements(row, 1, { fraction: 1, pixels: 0 }, { fraction: 0, pixels: 0 }),
                rows: 1,
                cost: row[0] >= PANORAMA_RATIO ? 0 : heightCost(1 / aspect, targetHeight, count)
                    + (count === 1 && photos.length > 1 ? 0.5 : 0),
            });
        }

        if (!wide || ratios[start] >= 1) continue;
        // Only a leading portrait spans rows, so visual and keyboard order agree.
        for (let count = 4; count <= 7 && start + count <= photos.length; count++) {
            const landscapes = ratios.slice(start + 1, start + count);
            if (landscapes.some(ratio => ratio < 1 || ratio >= PANORAMA_RATIO)) break;
            for (let split = 1; split < landscapes.length; split++) {
                if (split > 3 || landscapes.length - split > 3) continue;
                const top = landscapes.slice(0, split);
                const bottom = landscapes.slice(split);
                const topAspect = top.reduce((sum, ratio) => sum + ratio, 0);
                const bottomAspect = bottom.reduce((sum, ratio) => sum + ratio, 0);
                const inverseAspect = 1 / topAspect + 1 / bottomAspect;
                const portrait = ratios[start];
                const gutterCorrection = 1 - (top.length - 1) / topAspect - (bottom.length - 1) / bottomAspect;
                const sideWidth = {
                    fraction: 1 / (1 + portrait * inverseAspect),
                    pixels: -TRIP_GALLERY_GAP * (1 + portrait * gutterCorrection) / (1 + portrait * inverseAspect),
                };
                const portraitWidth = { fraction: 1 - sideWidth.fraction, pixels: -TRIP_GALLERY_GAP - sideWidth.pixels };
                const sideOffset = { fraction: portraitWidth.fraction, pixels: portraitWidth.pixels + TRIP_GALLERY_GAP };
                consider({
                    placements: [
                        { row: 1, rowSpan: 2, width: portraitWidth, offset: { fraction: 0, pixels: 0 } },
                        ...rowPlacements(top, 1, sideWidth, sideOffset),
                        ...rowPlacements(bottom, 2, sideWidth, sideOffset),
                    ],
                    rows: 2,
                    cost: heightCost(1 / (portrait + 1 / inverseAspect), targetHeight * 2, count),
                });
            }
        }
    }

    const placements: TripGalleryPlacement[] = [];
    let row = 0;
    while (placements.length < photos.length) {
        const candidate = choices[placements.length]!;
        placements.push(...candidate.placements.map(placement => ({ ...placement, row: placement.row + row })));
        row += candidate.rows;
    }
    return placements;
}

export function galleryLength(length: GalleryLength) {
    return `calc(${length.fraction * 100}% ${length.pixels < 0 ? '-' : '+'} ${Math.abs(length.pixels)}px)`;
}

/** Explicit fallbacks for browsers without lazy-image automatic sizes. */
export function tripGallerySizes(narrow: TripGalleryPlacement, wide: TripGalleryPlacement, portraitOnly: boolean) {
    if (portraitOnly) return 'auto, (min-width: 768px) 720px, calc(100vw - 3rem)';
    const viewportSlot = ({ fraction, pixels }: GalleryLength) =>
        `calc(${fraction * 100}vw - ${fraction * 32 - pixels}px)`;
    const desktop = '(hover: hover) and (pointer: fine)';
    return `auto, (min-width: 1184px) and ${desktop} ${wide.width.fraction * 1152 + wide.width.pixels}px, (min-width: 640px) and ${desktop} ${viewportSlot(wide.width)}, (min-width: 1184px) ${narrow.width.fraction * 1152 + narrow.width.pixels}px, ${viewportSlot(narrow.width)}`;
}
