import type { Browser } from '@playwright/test';

export interface PrefetchMeasurementOptions {
    baseURL: string;
    label: string;
    out: string;
    samples?: number;
    hovers?: number[];
    warm?: boolean;
}

export interface PrefetchMeasurementSample {
    journey: string;
    hoverMs: number;
    sample: number;
    clickToReadyMs: number;
    readyAt: number;
    activationAt: number;
    trustedInput: boolean;
    inputDelayMs: number;
    errors: string[];
}

export function measurePrefetch(options: PrefetchMeasurementOptions, dependencies?: {
    browser?: Pick<Browser, 'newContext' | 'version'>;
}): Promise<{
    measurementVersion: 2;
    label: string;
    results: PrefetchMeasurementSample[];
}>;
