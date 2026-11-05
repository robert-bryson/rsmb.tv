import type { Browser } from '@playwright/test';

export interface ReleaseValidationReport {
    baseURL: string;
    revision: string;
    checkedAt: string;
    routes: string[];
    images: number;
    errors: string[];
}

export interface ReleaseValidationOptions {
    baseURL: string;
    revision: string;
    jobId?: string;
    browser?: Browser;
    outputPath?: string;
    timeoutMs?: number;
}

export function validateReleasePreview(options: ReleaseValidationOptions): Promise<ReleaseValidationReport>;
export function assertAssetType(url: string, contentType: string): void;
export function assertDeploymentIdentity(deployment: unknown, revision: string, jobId?: string): string;
export function assertReleaseData(payloads: ReadonlyMap<string, unknown>): void;
export function assertTornadoGeometry(data: unknown, pathname: string): void;
