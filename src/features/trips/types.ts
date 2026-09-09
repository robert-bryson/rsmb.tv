export interface TripPhotoData {
    id: string;
    src: string;
    width: number;
    height: number;
    alt: string;
    caption?: string;
    location?: string;
    date?: string;
    srcSet?: string;
    sizes?: string;
}

export interface TripStop {
    id: string;
    name: string;
    coordinates: [longitude: number, latitude: number];
    date?: string;
    description?: string;
}

export interface TripManifest {
    id: string;
    dates: {
        start: string;
        end: string;
    };
    distanceMiles?: number;
    motorcycle?: string;
    regions?: string[];
    hero: TripPhotoData;
    route: {
        geoJson: string;
        staticImage?: string;
        alt?: string;
    };
    stops: TripStop[];
    photos: TripPhotoData[];
    galleries?: Record<string, string[]>;
}