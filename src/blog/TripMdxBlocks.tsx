import { lazy } from 'react';

export const TripGalleryBlock = lazy(() => import('../features/trips/components/TripGallery').then((module) => ({
    default: module.TripGallery,
})));

export const TripMapBlock = lazy(() => import('../features/trips/components/TripRouteMap').then((module) => ({
    default: module.TripRouteMap,
})));