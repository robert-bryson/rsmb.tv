import type { MetadataImage } from '../utils/pageMetadata';

export type BlogPostFormat = 'post' | 'trip';

export interface PostCountry {
    code: string;
    regions: string[];
}

export interface DevelopmentPostMeta {
    published: boolean;
    rowNumber: number;
    issues: string[];
    contentAvailable: boolean;
    manifestAvailable?: boolean;
    sheetUrl?: string;
    documentUrl?: string;
    driveFolderUrl?: string;
    assets?: {
        webpFiles: number;
        geoJsonFiles: number;
    };
}

/** Metadata shared by build tools and React, without importing virtual loaders. */
export interface BlogPostMeta {
    slug: string;
    title: string;
    date: string;
    description: string;
    tags: string[];
    countries?: PostCountry[];
    format?: BlogPostFormat;
    tripId?: string;
    image?: MetadataImage;
    series?: { id: string; title: string; order: number };
    development?: DevelopmentPostMeta;
}
