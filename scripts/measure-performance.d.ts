import type { Browser } from '@playwright/test';

export interface PerformanceOptions {
    baseURL: string;
    paths: string[];
    outputPath: string;
    samples: number;
    settleMs: number;
    timeoutMs: number;
}

interface VitalMeasurement {
    value: number;
    rating: string;
    target: string | null;
}

export interface PerformanceSample {
    route: string;
    sample: number;
    status: number | null;
    metrics: Partial<Record<'LCP' | 'CLS' | 'FCP' | 'TTFB', VitalMeasurement>> | null;
    scriptBytes: number | null;
    interaction: string | null;
    sampledINP: VitalMeasurement | null;
    errors: string[];
    error?: string;
}

export interface PerformanceReport {
    measuredAt: string;
    baseURL: string;
    conditions: Record<string, string | number>;
    failedSamples: number;
    errors: string[];
    results: PerformanceSample[];
}

export function parsePerformanceOptions(args: string[]): PerformanceOptions;
export function validatePerformanceSample(sample: Pick<PerformanceSample, 'status' | 'metrics' | 'errors' | 'scriptBytes'>): void;
export function measurePerformance(options: PerformanceOptions, adapters?: {
    browser?: Browser;
    onSample?: (sample: PerformanceSample) => void;
}): Promise<PerformanceReport>;
